---
name: ""
overview: ""
todos: []
isProject: false
---

# Sweet Fades: Adaptive Crossfade Engine

## Overview

Implement Plexamp-style "Sweet Fades" — intelligent crossfading between tracks using Plex's per-track loudness analysis data. When enabled, the app switches from the gapless `AVQueuePlayer` engine to a dual-`AVPlayer` crossfade engine that overlaps tracks with adaptive duration based on each track's loudness, dynamic range, and peak characteristics.

## Key Discovery: Plex Loudness Data

Plex Media Server automatically computes per-track loudness analysis (no Plex Pass required). This data is available in the standard API by fetching individual track metadata or using `includeElements=Stream` on bulk endpoints. Every track's `Stream` element includes:


| Field        | Type  | Description                                 |
| ------------ | ----- | ------------------------------------------- |
| `loudness`   | float | Integrated loudness (LUFS)                  |
| `gain`       | float | Track ReplayGain (dB)                       |
| `peak`       | float | True peak (linear, 0–1)                     |
| `lra`        | float | Loudness Range (LU) — dynamic range measure |
| `albumGain`  | float | Album-level ReplayGain (dB)                 |
| `albumPeak`  | float | Album-level true peak                       |
| `albumRange` | float | Album-level dynamic range                   |


This data powers the adaptive crossfade heuristic without any client-side audio analysis.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   JS Layer                           │
│                                                      │
│  useAudioStore ──→ playerAdapter ──→ ┌─────────────┐│
│                                      │ yhplayer-    ││
│  Sweet Fades OFF (gapless):         │ audio        ││
│    playerAdapter routes to           │ (AVQueue-   ││
│    yhplayer-audio as today           │  Player)    ││
│                                      └─────────────┘│
│  Sweet Fades ON (crossfade):        ┌─────────────┐│
│    playerAdapter routes to           │ yhplayer-   ││
│    yhplayer-crossfade                │ crossfade   ││
│                                      │ (Dual       ││
│                                      │  AVPlayer)  ││
│                                      └─────────────┘│
└─────────────────────────────────────────────────────┘
```

When crossfade is enabled, `playerAdapter.ts` delegates all calls to the crossfade module instead of the gapless module. Both modules expose the same API surface (same events, same methods), so `useAudioStore` and all UI components work unchanged.

## 1. Plex API: Fetch Loudness Data

**File:** `utils/plex-client.ts`

### 1a. Add `includeElements=Stream` to `fetchAllTracks`

The existing `fetchAllTracks` call uses `includeFields` to optimize payload. Add `includeElements: 'Stream'` to include the nested `Stream` elements that contain loudness data.

### 1b. Extract loudness fields in `formatTrack`

Parse the Stream data from each track's `Media[0].Part[0].Stream[]` (first stream with `streamType=2` is audio). Map to new fields on `Song`:

```typescript
// In formatTrack, after existing field extraction:
const audioStream = media?.Part?.[0]?.Stream?.find(
  (s: any) => s.streamType === '2' || s.loudness != null
);
```

### 1c. Extend `Song` type

**File:** `types/song.ts`

```typescript
export interface LoudnessData {
  loudness: number;    // Integrated LUFS
  gain: number;        // Track ReplayGain dB
  peak: number;        // True peak (0–1)
  lra: number;         // Loudness Range LU
  albumGain: number;   // Album ReplayGain dB
  albumPeak: number;   // Album true peak
  albumRange: number;  // Album dynamic range
}

export interface Song {
  // ... existing fields ...
  loudnessData?: LoudnessData;
}
```

## 2. New Native Module: `yhplayer-crossfade`

**New directory:** `modules/yhplayer-crossfade/`

Mirror the structure of `yhplayer-audio/`:

```
modules/yhplayer-crossfade/
├── expo-module.config.json
├── package.json
├── tsconfig.json
├── ios/
│   ├── YhplayerCrossfade.podspec
│   └── YhplayerCrossfadeModule.swift
└── src/
    ├── index.ts
    └── YhplayerCrossfadeModule.ts
```

### 2a. Core Architecture (Swift)

**File:** `modules/yhplayer-crossfade/ios/YhplayerCrossfadeModule.swift`

Two `AVPlayer` instances ("deck A" and "deck B") alternate roles. At any time, one is "active" (playing the current track) and the other is "on-deck" (pre-loaded with the next track, ready to start for the crossfade).

```swift
class YhplayerCrossfadeModule: Module {
    private var deckA: AVPlayer?
    private var deckB: AVPlayer?
    private var activeDeck: Deck = .a  // enum { a, b }
    private var crossfadeTimer: Timer?

    // Queue management (same as yhplayer-audio)
    private var trackOrder: [String] = []
    private var trackMetadata: [String: TrackRecord] = []
    private var currentIndex: Int = -1

    // Crossfade state
    private var isCrossfading: Bool = false
    private var crossfadeStartTime: CFAbsoluteTime = 0
    private var crossfadeDuration: Double = 0  // Computed per-transition
}
```

### 2b. Crossfade Triggering

A high-frequency timer (or `addPeriodicTimeObserver` on the active player, every 0.25s) monitors the active deck's position. When `remaining <= crossfadeDuration`:

1. Load the next track onto the on-deck player (if not already pre-loaded)
2. Start the on-deck player
3. Begin the volume ramp:
  - Active deck: 1.0 → 0.0 (fade out)
  - On-deck: 0.0 → 1.0 (fade in)
4. When the crossfade completes:
  - Pause/reset the old active deck
  - Swap deck roles
  - Pre-load the next-next track on the now-idle deck
  - Emit `PlaybackActiveTrackChanged` event

### 2c. Volume Ramping

Use `**AVMutableAudioMix**` with `setVolumeRampFromStartVolume:toEndVolume:timeRange:` for the fade-out deck. This is the most efficient approach — it runs on the audio render thread and doesn't require timer-driven volume updates.

For the fade-in deck, use the same technique but with 0→1 ramp.

**Equal-power crossfade curve:** For perceptually smooth transitions, use `sqrt()` curves rather than linear:

- Fade-out: `volume = sqrt(1.0 - t)`  where t goes 0→1
- Fade-in: `volume = sqrt(t)`

Since `AVMutableAudioMix` only supports linear ramps, implement equal-power via multiple short linear segments (e.g., 10 segments over the crossfade duration) or use manual gain control in the `MTAudioProcessingTap`.

### 2d. Audio Processing (DSP)

Both decks need audio processing (EQ, gain, normalization, mono). The existing `AudioDSPState` singleton has **per-channel filter state** (biquad delays) that assumes one stream. For dual players:

- Change `AudioDSPState` to support two independent filter state slots (A and B)
- Or create two instances with a shared configuration but independent delay lines
- Each deck's `MTAudioProcessingTap` uses its own filter state slot

```swift
final class AudioDSPState {
    static let shared = AudioDSPState()

    // Shared config (set from JS)
    private var _eqEnabled: Bool = false
    private var _eqBands: [(frequency: Float, gain: Float)] = []
    // ...

    // Per-deck filter state
    private var _biquadDelaysL_A: [[Double]] = []
    private var _biquadDelaysR_A: [[Double]] = []
    private var _biquadDelaysL_B: [[Double]] = []
    private var _biquadDelaysR_B: [[Double]] = []

    func processAudio(_ bufferList: ..., frameCount: ..., deck: Deck) {
        // Use deck-specific delay lines
    }
}
```

### 2e. Pre-loading

When a track starts playing, immediately pre-load the next track on the idle deck:

```swift
func preloadNextTrack() {
    guard currentIndex + 1 < trackOrder.count else { return }
    let nextId = trackOrder[currentIndex + 1]
    guard let track = trackMetadata[nextId] else { return }
    let item = AVPlayerItem(url: URL(string: track.url)!)
    idleDeck.replaceCurrentItem(with: item)
}
```

### 2f. API Surface

The crossfade module exposes the **exact same API** as `yhplayer-audio`:


| Method                          | Notes                                                           |
| ------------------------------- | --------------------------------------------------------------- |
| `setupPlayer(options)`          | Creates both AVPlayers, configures audio session                |
| `add(tracks, insertAfterIndex)` | Adds to internal queue                                          |
| `reset()`                       | Stops both players, clears queue                                |
| `remove(indices)`               | Removes from queue                                              |
| `skip(index)`                   | Hard-cuts to track (no crossfade for manual skips, or optional) |
| `play()` / `pause()`            | Controls active deck                                            |
| `seekTo(position)`              | Seeks active deck                                               |
| `setVolume(value)`              | Sets master volume on both decks                                |
| ...                             | All other methods identical                                     |


**Additional method:**


| Method                       | Description                           |
| ---------------------------- | ------------------------------------- |
| `setCrossfadeConfig(config)` | Sets crossfade parameters (see below) |


### 2g. Crossfade Configuration

```swift
struct CrossfadeConfig: Record {
    @Field var enabled: Bool = true
    @Field var defaultDuration: Double = 4.0     // seconds, fallback
    @Field var adaptiveEnabled: Bool = true       // use loudness data for adaptive duration
    @Field var minDuration: Double = 1.0          // minimum crossfade seconds
    @Field var maxDuration: Double = 8.0          // maximum crossfade seconds
    @Field var fadeInOnManualSkip: Bool = true     // short fade-in when user skips
    @Field var manualSkipFadeDuration: Double = 0.5  // seconds
}
```

## 3. Adaptive Crossfade Duration Algorithm

**File:** `lib/crossfadeAlgorithm.ts` (JS-side, computed per transition)

Given the outgoing track's `LoudnessData` and the incoming track's `LoudnessData`, compute optimal crossfade duration:

```typescript
export function computeCrossfadeDuration(
  outgoing: LoudnessData | undefined,
  incoming: LoudnessData | undefined,
  config: { defaultDuration: number; minDuration: number; maxDuration: number }
): number {
  if (!outgoing || !incoming) return config.defaultDuration;

  // 1. Dynamic range score: higher LRA → track has quiet sections → longer fade works
  const outLRA = outgoing.lra;
  const inLRA = incoming.lra;
  const avgLRA = (outLRA + inLRA) / 2;

  // 2. Peak-based: low peak on outgoing end suggests quiet ending
  const outPeakFactor = outgoing.peak < 0.7 ? 1.3 : 1.0;

  // 3. Loudness gap: big difference → needs more transition time
  const loudnessGap = Math.abs(outgoing.loudness - incoming.loudness);
  const gapFactor = 1.0 + Math.min(loudnessGap / 20, 0.5);

  // 4. Base duration from LRA (2-8s range mapped from 0-20 LU range)
  const lraDuration = config.minDuration +
    (avgLRA / 20) * (config.maxDuration - config.minDuration);

  // 5. Final duration
  const duration = lraDuration * outPeakFactor * gapFactor;
  return Math.max(config.minDuration, Math.min(config.maxDuration, duration));
}
```

This duration is sent to the native module per-transition via a new method:

```typescript
setNextCrossfadeDuration(seconds: number): Promise<void>
```

The JS layer computes this when the next track is known (queue change or track advance) and pushes it to native.

## 4. TypeScript Module Interface

**File:** `modules/yhplayer-crossfade/src/YhplayerCrossfadeModule.ts`

```typescript
type YhplayerCrossfadeModuleType = {
  // Identical to YhplayerAudioModuleType
  setupPlayer: (options?: Record<string, unknown>) => Promise<void>;
  add: (tracks: Track[], insertAfterIndex?: number) => Promise<void>;
  reset: () => Promise<void>;
  remove: (indices: number[]) => Promise<void>;
  removeUpcomingTracks: () => Promise<void>;
  move: (fromIndex: number, toIndex: number) => Promise<void>;
  skip: (index: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setVolume: (value: number) => Promise<void>;
  setRate: (value: number) => Promise<void>;
  setRepeatMode: (mode: number) => Promise<void>;
  setEqualizerBands: (bands: Array<{ frequency: number; gain: number }>) => Promise<void>;
  setEqualizerEnabled: (enabled: boolean) => Promise<void>;
  setOutputGain: (gainDb: number) => Promise<void>;
  setNormalizationEnabled: (enabled: boolean) => Promise<void>;
  setMonoAudioEnabled: (enabled: boolean) => Promise<void>;
  getPlaybackState: () => PlaybackState;
  getActiveTrackIndex: () => number;
  getQueue: () => Track[];
  addListener: (event: string, callback: (payload: unknown) => void) => { remove: () => void };
  removeListeners: (count: number) => void;

  // Crossfade-specific
  setCrossfadeConfig: (config: CrossfadeConfig) => Promise<void>;
  setNextCrossfadeDuration: (seconds: number) => Promise<void>;
};
```

## 5. Player Adapter: Engine Switching

**File:** `lib/playerAdapter.ts`

The adapter becomes the routing layer. Based on the crossfade setting, it delegates to one module or the other.

```typescript
import { YhplayerAudioModule } from '@/modules/yhplayer-audio';
import { YhplayerCrossfadeModule } from '@/modules/yhplayer-crossfade';

let crossfadeMode = false;

function getPlayer() {
  if (crossfadeMode && YhplayerCrossfadeModule) {
    return YhplayerCrossfadeModule;
  }
  if (YhplayerAudioModule) return YhplayerAudioModule;
  return null;
}
```

**Engine switch flow** (when user toggles crossfade on/off):

1. Get current playback state (track, position, queue)
2. `reset()` the old engine
3. `setupPlayer()` on the new engine
4. Rebuild the queue on the new engine (`add(tracks)`)
5. `skip(currentIndex)` + `seekTo(position)` to restore position
6. `play()` if was playing

This happens in `usePlaybackSettingsStore` or a dedicated engine-switch function in the adapter.

## 6. Playback Settings Store

**File:** `hooks/usePlaybackSettingsStore.ts`

Add crossfade settings to the existing store:

```typescript
// New storage keys
const STORAGE_CROSSFADE_ENABLED = 'PLAYBACK_CROSSFADE_ENABLED';
const STORAGE_CROSSFADE_DURATION = 'PLAYBACK_CROSSFADE_DURATION';
const STORAGE_CROSSFADE_ADAPTIVE = 'PLAYBACK_CROSSFADE_ADAPTIVE';

// New state fields
crossfadeEnabled: boolean;           // default false
crossfadeDuration: number;           // default 4 (seconds, used when adaptive is off)
crossfadeAdaptiveEnabled: boolean;   // default true (use Plex loudness data)

// New actions
setCrossfadeEnabled: (enabled: boolean) => void;
setCrossfadeDuration: (seconds: number) => void;
setCrossfadeAdaptiveEnabled: (enabled: boolean) => void;
```

`setCrossfadeEnabled` triggers the engine switch in `playerAdapter`.

## 7. UI: Playback Settings Page

**File:** `app/(tabs)/(settings)/playback.tsx`

Add a new "Crossfade" section below the existing EQ/Gain/Normalization sections:

- **Sweet Fades toggle** (Switch) — enables/disables crossfade engine
  - Description: "Smoothly blend between tracks using loudness analysis"
- **Adaptive** toggle — when on, uses Plex loudness data; when off, uses fixed duration
  - Only shown when Sweet Fades is enabled
- **Duration slider** — 1–12 seconds, shown when adaptive is off (or as "default duration" when adaptive is on)
  - Current value displayed as label

## 8. Audio Store Integration

**File:** `hooks/useAudioStore.ts`

### 8a. Pass loudness data during queue building

When `songToTrack` converts a `Song` to a `Track` for the native player, also store the loudness data. For the crossfade engine, the JS layer needs to compute and push the crossfade duration before each transition.

### 8b. Crossfade duration computation hook

Add a listener for `PlaybackProgressUpdated`. When the remaining time reaches a threshold (e.g., crossfade duration + 5s buffer), compute the next crossfade duration using `computeCrossfadeDuration()` and call `setNextCrossfadeDuration()`.

This replaces/augments the existing pre-warm logic (which fetches the first 256KB of the next track at 45s remaining).

### 8c. Bonus: ReplayGain normalization

Since we now have `gain` data per track, add an option to apply ReplayGain normalization:

- When a new track starts, apply `gain` as a volume adjustment
- Can be done via `setOutputGain()` per-track, or via a dedicated native method
- Two modes: "Track Gain" (per-track loudness matching) and "Album Gain" (preserves album dynamics)

## 9. Edge Cases

### Manual skip

When the user manually skips forward/backward, do a short fade (0.3–0.5s) rather than a full crossfade. This feels snappy while avoiding a hard cut.

### Repeat track

When repeat mode is "Track", don't crossfade — just loop seamlessly.

### Repeat queue

When the last track ends and repeat mode is "Queue", crossfade into the first track.

### Queue changes during crossfade

If the user modifies the queue while a crossfade is in progress, complete the current crossfade, then re-evaluate the next track.

### Podcast mode

Podcasts (`source === 'podcast'`) should never crossfade. The adapter should route to the gapless engine regardless of the crossfade setting.

### Live albums / classical

When consecutive tracks are from the same album and are sequential disc/track numbers, reduce crossfade duration or disable it (preserves intentional album flow). This is a heuristic that can be refined over time.

## Files Changed Summary


| File                                                           | Change                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `types/song.ts`                                                | Add `LoudnessData` interface and `loudnessData?` field to `Song`         |
| `utils/plex-client.ts`                                         | Add `includeElements=Stream` to fetch, extract loudness in `formatTrack` |
| `modules/yhplayer-crossfade/`                                  | **New module** — dual-AVPlayer crossfade engine                          |
| `modules/yhplayer-crossfade/ios/YhplayerCrossfadeModule.swift` | **New** — core crossfade engine                                          |
| `modules/yhplayer-crossfade/src/YhplayerCrossfadeModule.ts`    | **New** — TS type definitions                                            |
| `modules/yhplayer-crossfade/src/index.ts`                      | **New** — module exports                                                 |
| `lib/crossfadeAlgorithm.ts`                                    | **New** — adaptive duration computation                                  |
| `lib/playerAdapter.ts`                                         | Engine switching logic (gapless ↔ crossfade)                             |
| `modules/yhplayer-audio/ios/YhplayerAudioModule.swift`         | Refactor `AudioDSPState` to support per-deck filter state                |
| `hooks/usePlaybackSettingsStore.ts`                            | Add crossfade settings (enabled, duration, adaptive)                     |
| `hooks/useAudioStore.ts`                                       | Crossfade duration computation + loudness-aware pre-warm                 |
| `app/(tabs)/(settings)/playback.tsx`                           | Crossfade UI section                                                     |


## Implementation Order

1. `**types/song.ts` + `utils/plex-client.ts`** — Get loudness data flowing (small, self-contained)
2. `**lib/crossfadeAlgorithm.ts`** — Pure function, easy to test independently
3. `**modules/yhplayer-crossfade/**` — The big native module (can start with fixed-duration crossfade, add adaptive later)
4. `**modules/yhplayer-audio/` AudioDSPState refactor** — Per-deck filter state
5. `**lib/playerAdapter.ts`** — Engine switching
6. `**hooks/usePlaybackSettingsStore.ts`** — Crossfade settings + persistence
7. `**hooks/useAudioStore.ts**` — Loudness-aware pre-warm + duration push
8. `**app/(tabs)/(settings)/playback.tsx**` — UI

