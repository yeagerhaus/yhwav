# yhwav

Plex music player built with Expo and React Native. iOS only.

## Stack

| | |
|-|-|
| Expo 54 / React Native 0.81 | React 19 |
| expo-router 6 | Zustand 5 |
| Reanimated 4 | Biome 2 / TypeScript 5.9 |
| Bun | Custom native audio module (AVQueuePlayer) |

## Setup

Requires Bun, Xcode with iOS Simulator, and a Plex server with music.

```bash
bun prep    # install deps + pods
bun start   # metro + dev client
```

Auth is PIN-based — no env vars needed. Sign in via Settings > Sign in with Plex, then enter the PIN at plex.tv/activate.

## Scripts

| Command | What it does |
|---------|-------------|
| `bun start` | Metro + dev client |
| `bun prep` | Install deps + pods |
| `bun b` | EAS build (iOS dev profile) |
| `bun kill` | Kill port 8081 |
| `bun clean` | Nuke node_modules, Pods, .expo |
| `bun up` | Update deps + Expo version check |
| `bun check:all` | tsc + biome |

## Structure

```
app/                    # file-based routing (expo-router)
  (tabs)/
    (library)/          # artists, albums, playlists, songs
    (podcasts)/         # podcast screens
    (settings)/         # settings
    search/             # search
  music/[id].tsx        # full-screen player modal
components/             # BottomSheet, Player, DynamicItem, navigation, etc.
hooks/                  # Zustand stores (library, audio, search, playback settings)
utils/                  # Plex API client, auth, discovery, caching, scrobble queue
modules/yhwav-audio/    # custom Expo module — gapless playback via AVQueuePlayer
constants/              # API config, colors
types/                  # shared TypeScript types
tools/run.ts            # dev entry script
```

## Audio

Playback uses a custom native module (`yhwav-audio`) wrapping AVQueuePlayer for gapless playback. Queue state and playback position persist across restarts via AsyncStorage.

## License

Private and proprietary.
