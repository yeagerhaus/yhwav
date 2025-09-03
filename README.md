# 🎧 YH Player

A modern music player built with Expo + React Native, featuring Plex Media Server integration, native iOS controls, and an animated UI. Stream your music library with seamless playback and intuitive navigation.

---

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev) + [React Native](https://reactnative.dev)
- **Routing**: [expo-router](https://expo.github.io/router/) with file-based routing
- **Audio Engine**: [`react-native-track-player`](https://github.com/doubleencore/react-native-track-player) for native audio playback
- **Media Source**: [Plex Media Server](https://www.plex.tv/) integration for streaming
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) for global state
- **Animations**: [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/) + [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/)
- **UI Components**: Custom themed components with blur effects and gradients
- **Dev Tools**: Bun, TSX, Biome (linting/formatting), Jest (testing)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and Bun
- iOS Simulator (Xcode)
- Plex Media Server with music library
- Environment variables configured (see Configuration section)

### Installation & Setup

```bash
# Install dependencies and setup iOS
bun prep

# Start development server
bun start
```

**First time setup**: Install the custom Expo dev client via Xcode or TestFlight.

### Environment Configuration

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_PLEX_SERVER=https://your-plex-server.com
EXPO_PUBLIC_PLEX_TOKEN=your-plex-token
EXPO_PUBLIC_PLEX_MUSIC_SECTION_ID=your-music-section-id
```

---

## 📦 Development Scripts

| Command | Description |
|---------|-------------|
| `bun start` | Starts Metro + launches iOS simulator |
| `bun prep` | Install deps, pod install, prebuild (iOS) |
| `bun b` | Build dev client via EAS (iOS only) |
| `bun check:all` | Run TypeScript + Biome + ESLint checks |
| `bun test` | Run Jest test suite |
| `bun clean` | Clean node_modules, Pods, and .expo cache |

---

## 🎵 Features

### ✅ Implemented
- **Plex Integration**: Stream music directly from your Plex Media Server
- **Native Audio Controls**: Lock screen and Control Center integration
- **Animated UI**: Smooth transitions with gesture-based navigation
- **Library Management**: Browse by Artists, Albums, Songs, and Playlists
- **Search & Browse**: Category-based music discovery
- **Queue Management**: Play songs with automatic queue handling
- **Background Playback**: Continue playing when app is backgrounded
- **Artwork Colors**: Dynamic background colors extracted from album art
- **Gesture Controls**: Swipe to dismiss, drag to seek, pull to refresh

### 🚧 In Development
- Waveform visualization
- Playlist creation and management
- Offline download support
- Enhanced search functionality

---

## 📁 Project Structure

```
yhplayer/
├── app/                    # Expo Router file-based routing
│   ├── (tabs)/            # Tab navigation
│   │   ├── (library)/     # Music library screens
│   │   └── (search)/      # Search and browse
│   └── music/[id].tsx     # Full-screen player modal
├── cmps/                  # Reusable components
│   ├── BottomSheet/       # Mini & expanded player
│   ├── Player/           # Audio controls & progress
│   ├── DynamicItem/      # List/grid item components
│   └── navigation/       # Tab bar & headers
├── ctx/                  # React Context providers
│   ├── AudioContext.tsx  # Audio playback state
│   ├── SongContext.tsx   # Current song state
│   ├── PlaybackContext.tsx # Playback progress
│   └── RootScaleContext.tsx # Modal scaling
├── hooks/                # Custom React hooks
├── utils/                # Utility functions
│   ├── plex.ts          # Plex API integration
│   ├── cache.ts         # AsyncStorage caching
│   └── song.ts          # Song data processing
├── types/               # TypeScript type definitions
└── tools/run.ts         # Custom Bun dev entry point
```

---

## 🎨 Architecture

### State Management
- **Zustand Store**: `useLibraryStore` for music library data
- **React Context**: Audio, Song, and Playback contexts for real-time state
- **AsyncStorage**: Persistent queue and playback position

### Audio System
- **TrackPlayer**: Native audio engine with iOS integration
- **Queue Management**: Automatic track queuing and restoration
- **Background Playback**: Seamless background audio continuation
- **Remote Controls**: Lock screen and Control Center support

### UI/UX
- **Gesture Navigation**: Swipe gestures for modal dismissal
- **Animated Transitions**: Smooth scaling and translation effects
- **Dynamic Theming**: Album art-based color extraction
- **Blur Effects**: Native iOS blur for tab bar and overlays

---

## 🔧 Configuration

### Plex Setup
1. Ensure your Plex server is accessible
2. Get your Plex token from server settings
3. Find your music section ID in Plex web interface
4. Configure environment variables

### iOS Development
- Requires Xcode 15+ for iOS 17+ support
- Custom Expo dev client for native modules
- EAS Build for development builds

---

## 📱 Supported Platforms

- ✅ **iOS** (Primary platform with full feature support)
- ⛔ **Android** (Planned for future releases)
- ⛔ **Web** (Not supported due to native audio requirements)

---

## 🛣️ Roadmap

### Short Term
- [ ] Enhanced playlist management
- [ ] Offline download functionality
- [ ] Improved search with filters
- [ ] Lyrics display support

### Long Term
- [ ] Android support
- [ ] Social features (sharing, collaborative playlists)
- [ ] Advanced audio effects
- [ ] Smart recommendations

---

## 🤘 Author

Made with ✨ & 🔊 by [Cole Yeager](https://github.com/cole-yeager)

---

## 📄 License

This project is private and proprietary.