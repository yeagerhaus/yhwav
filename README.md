# YH Player

A music player for Plex, built with Expo and React Native.

## Tech Stack

| Library | Version |
|---------|---------|
| Expo | 54 |
| React | 19 |
| React Native | 0.81 |
| expo-router | 6 |
| react-native-track-player | 4 |
| Zustand | 5 |
| Reanimated | 4 |
| Biome | 2 |
| TypeScript | 5.9 |
| Bun | runtime + package manager |

## Getting Started

**Prerequisites:** Bun, Xcode with iOS Simulator, a Plex Media Server with a music library.

```bash
bun prep    # install deps + pod install
bun start   # start Metro + launch iOS simulator
```

**Authentication:** PIN-based, no env vars needed. Open the app, go to Settings, tap "Sign in with Plex", and enter the PIN at plex.tv/activate. The app auto-discovers your servers.

## Scripts

| Command | Description |
|---------|-------------|
| `bun start` | Start Metro + launch iOS simulator |
| `bun prep` | Install deps + pod install |
| `bun b` | EAS build (iOS dev client) |
| `bun kill` | Kill process on port 8081 |
| `bun clean` | Remove node_modules, Pods, .expo |
| `bun up` | Update deps + Expo version check |
| `bun check:tsc` | TypeScript type check |
| `bun check:biome` | Biome lint + format |
| `bun check:all` | Run tsc + biome |

## Features

- Stream music from Plex Media Server
- Browse by artists, albums, songs, and playlists
- Search with hub-based category results
- Queue management with persistence across restarts
- Lock screen and Control Center controls
- Background playback
- Dynamic colors extracted from album artwork
- Gesture-based navigation (swipe dismiss, drag seek, pull to refresh)
- Animated transitions with Reanimated

## Project Structure

```
yhplayer/
├── app/                        # expo-router file-based routing
│   ├── (tabs)/
│   │   ├── (library)/          # artists, albums, playlists, songs
│   │   ├── search/             # search screen
│   │   └── settings.tsx
│   └── music/[id].tsx          # full-screen player modal
├── components/
│   ├── BottomSheet/            # mini + expanded player
│   ├── Player/                 # audio controls, progress, artwork
│   ├── DynamicItem/            # list/grid item renderers
│   ├── SearchItem/             # search result items
│   ├── Overlay/                # overlays
│   └── navigation/             # tab bar, headers
├── ctx/
│   └── RootScaleContext.tsx     # modal scale animation context
├── hooks/                      # useLibraryStore, useAudioStore, useSearchStore, etc.
├── utils/                      # Plex API client, auth, discovery, caching
├── constants/                  # API config, colors
├── types/                      # TypeScript types (song, album, artist, playlist)
└── tools/run.ts                # custom Bun dev entry point
```

## Architecture

### State Management
All global state is in Zustand stores: `useLibraryStore` (library data + fetching), `useAudioStore` (playback state, queue, TrackPlayer sync), and `useSearchStore` (search queries + results). Queue and playback position are persisted to AsyncStorage.

### Audio System
`react-native-track-player` handles native audio. The audio store manages queue operations, track restoration on cold start, and remote control events (lock screen, Control Center).

### UI
Gesture-driven navigation via `react-native-gesture-handler`. Animated transitions with Reanimated (player sheet, modal scaling). Album artwork colors extracted with `react-native-image-colors` for dynamic theming.

## Platforms

- iOS — primary, fully supported
- Android — project dir exists, untested
- Web — not supported

## Author

Made by [Cole Yeager](https://github.com/cole-yeager)

## License

This project is private and proprietary.
