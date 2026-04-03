# Rite

Your collection. Your ritual. Nothing else.

Plex music player built with Expo and React Native. iOS only.

## Stack

| | |
|-|-|
| Expo 54 / React Native 0.81 | React 19 |
| expo-router 6 | Zustand 5 |
| Reanimated 4 | Biome 2 / TypeScript 5.9 |
| Bun | MMKV (playback settings & fast storage) |
| Custom native audio module (`yhwav-audio`) | `react-native-carplay` (in-car UI) |

Notable Expo libraries: background fetch & task manager, notifications, file system, image, blur / glass effect, dev client.

## Features

- **Library** — Artists, albums, playlists, songs; search; recently played; **artist radio** (Plex station playlist) when the server exposes it.
- **Podcasts** — Subscriptions, episodes, downloads, iTunes search, playback with podcast-specific behavior (e.g. gapless-style transitions without crossfade).
- **Downloads & offline** — Music and podcast downloads; **offline mode** filters the library to downloaded items; storage screen shows queue progress, cache clear, and bulk download removal.
- **Playback** — Custom iOS engine with **gapless-style scheduling**, optional **Sweet Fades** (crossfades) including **adaptive** overlap from Plex loudness when available; 10-band EQ, presets, output gain, loudness normalization, mono; per-network streaming bitrate (Wi‑Fi / cellular) and optional transcode cap; sleep timer; queue and repeat/shuffle; **scrobble** queue to Plex (with offline retry).
- **CarPlay** — Tabbed lists (recent + playlists), now playing; wired in `app/_layout.tsx` via `lib/carplay.ts` and native scene delegates.
- **Background** — Background fetch task for new podcast episodes with local notifications when configured.
- **UI** — Appearance settings, splash handling, music visualizer (where enabled), shared typography and styles.

## Setup

Requires Bun, Xcode with iOS Simulator (or device), and a Plex server with music.

```bash
bun prep    # install deps + pods
bun start   # metro + dev client
```

Auth is PIN-based. Sign in via Settings > Sign in with Plex, then enter the PIN at plex.tv/activate.

For podcast background checks, grant notification permission when prompted (see `notification-prompt` flow in app).

## Scripts

| Command | What it does |
|---------|-------------|
| `bun start` | Metro + dev client (via `tools/run.ts`) |
| `bun start:quick` | Start without running `bun install` first |
| `bun start:tunnel` | Metro with tunnel host (skip install) |
| `bun start:sim` | Expo dev client bound to localhost (simulator-friendly) |
| `bun prep` | Install deps + CocoaPods |
| `bun kill` | Free port 8081 |
| `bun b` | EAS iOS development build |
| `bun b:test` | Local Release run on device |
| `bun clean` | Remove node_modules, Pods, Podfile.lock, .expo |
| `bun up` | Update deps + Expo doctor-style check |
| `bun check:all` | TypeScript + Biome |
| `bun ios` / `bun android` | `expo run:ios` / `expo run:android` |

## Structure

```
app/                         # expo-router
  _layout.tsx                # root: CarPlay setup, background fetch, splash, etc.
  (tabs)/
    (library)/               # artists, albums, playlists, songs
    (podcasts)/              # podcast feeds & episodes
    (settings)/              # account, appearance, playback, storage, developer
    search/
  music/[id].tsx             # full-screen player
components/                  # UI primitives, player, sheets, navigation
hooks/                       # Zustand stores (library, audio, downloads, playback settings, …)
lib/                         # playerAdapter, CarPlay, storage (MMKV), network route helpers
utils/                       # Plex client, auth, cache, scrobble queue, background-fetch task, plex-stream-url
modules/yhwav-audio/         # Expo native module — iOS audio engine (see below)
constants/                   # theme, styles, API config
types/
tools/run.ts                 # dev entry script
```

## Audio

Playback uses the **`yhwav-audio`** native module on iOS: an **AVAudioEngine**-based player (`AudioEnginePlayer`) with dual decks for crossfades, on-engine EQ / normalization / mono, and file caching. Queue advancement and crossfade timing are coordinated with JS (`hooks/useAudioStore.ts`, `lib/playerAdapter.ts`).

Queue order, current track, position, repeat/shuffle, volume, and rate persist across launches (playback settings use MMKV; queue/song state uses the app’s persisted audio store keys).

## CarPlay

Native: `ios/Rite/CarPlaySceneDelegate.swift` connects the CarPlay scene to `react-native-carplay`; `PhoneSceneDelegate.swift` ensures the phone window scene exists alongside the CarPlay scene. JS: `lib/carplay.ts`, initialized from `app/_layout.tsx`.

## Agent / Cursor rules

Project-specific guidance for playback, Plex URLs, downloads, and native audio lives in **`.cursor/rules/`** (`*.mdc`). Those files are the source of truth for edge cases when editing `useAudioStore`, `playerAdapter`, or download/offline code.

## License

Private and proprietary.
