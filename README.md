# 🎧 YH Player

A custom music player built with Expo + React Native, optimized for iOS with native media control and local file access.

---

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev), [React Native](https://reactnative.dev)
- **Routing**: [expo-router](https://expo.github.io/router/)
- **Native Modules**:
  - [`react-native-track-player`](https://github.com/doubleencore/react-native-track-player) for native audio playback
  - [`react-native-get-music-files`](https://github.com/cinder92/react-native-get-music-files) for local song metadata
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Dev Tools**: Bun, TSX, Biome, Jest

---

## 🚀 Getting Started

```bash
bun i             # Install deps, run pod install, prebuild iOS
bun start         # Starts Metro & launches iOS simulator

    First time? You may need to install the custom Expo dev client via Xcode or TestFlight.

📦 Dev Scripts
Command	Description
bun start	Starts Metro + runs iOS simulator
bun ios	Run app in iOS simulator directly
bun i	Install deps, pod install, prebuild (iOS)
bun b	Build dev client via EAS (iOS only)
bun check:all	Run TS + Biome + ESLint checks
bun test	Run Jest test suite
🧪 Features

    ✅ Load audio files from local iOS file system

    ✅ Play audio with native lock screen & control center integration

    ✅ Read song metadata from audio files

    ✅ Designed to support album art, waveform visualizer, and shuffle/play features

📁 Directory Structure

/assets        → Icons, splash, images  
/cmps          → Custom components (Visualizer, etc.)  
/ctx           → Zustand stores and context  
/tools/run.ts  → Custom Bun-powered dev entry point  

📋 Roadmap

Add waveform visualization

Enable background audio playback

Support playlists and favorites

    iCloud Drive import support

📱 Supported Platforms

    ✅ iOS (custom dev client)

    ⛔ Android (planned for future)

🤘 Author

Made with ✨ & 🔊 by Cole Yeager