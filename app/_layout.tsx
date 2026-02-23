// Crypto polyfills removed - using expo-crypto instead
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { InteractionManager, LogBox, StyleSheet, useColorScheme } from 'react-native';

LogBox.ignoreAllLogs();

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { AddToPlaylistModal, Div, MiniPlayer } from '@/components';
import { Colors } from '@/constants';
import { RootScaleProvider, useRootScale } from '@/ctx/RootScaleContext';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { useAudioStore, useTrackPlayerSync } from '@/hooks/useAudioStore';
import { useColors } from '@/hooks/useColors';
import { useDevSettingsStore } from '@/hooks/useDevSettingsStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { usePlaybackSettingsStore } from '@/hooks/usePlaybackSettingsStore';
import { usePodcastDownloadsStore } from '@/hooks/usePodcastDownloadsStore';
import { usePodcastProgressStore } from '@/hooks/usePodcastProgressStore';
import { usePodcastStore } from '@/hooks/usePodcastStore';
import { setupCarPlay, teardownCarPlay } from '@/lib/carplay';
import { rehydrateLibraryStore, saveLibraryToCache } from '@/utils';
import { fetchAllAlbums, fetchAllArtists, fetchAllPlaylists, fetchAllTracks, fetchRecentlyPlayed, testPlexServer } from '@/utils/plex';
import { plexAuthService } from '@/utils/plex-auth';
import { initScrobbleQueue } from '@/utils/scrobble-queue';

function AudioSync() {
	useTrackPlayerSync();
	return null;
}

const CustomDarkTheme = {
	...DarkTheme,
	colors: {
		...DarkTheme.colors,
		background: Colors.dark.background,
		card: Colors.dark.background,
	},
};

const CustomLightTheme = {
	...DefaultTheme,
	colors: {
		...DefaultTheme.colors,
		background: Colors.light.background,
		card: Colors.light.background,
	},
};

function AnimatedStack() {
	const colors = useColors();
	const { scale } = useRootScale();
	const router = useRouter();
	const currentSong = useAudioStore((state) => state.currentSong);
	const screenBackground = colors.background;

	const animatedStyle = useAnimatedStyle(() => {
		return {
			transform: [
				{ scale: scale.value },
				{
					translateY: (1 - scale.value) * -150,
				},
			],
		};
	});

	return (
		<Div style={{ flex: 1, backgroundColor: screenBackground }}>
			<Animated.View style={[styles.stackContainer, animatedStyle]}>
				<Stack screenOptions={{ contentStyle: { backgroundColor: screenBackground } }}>
					<Stack.Screen name='(tabs)' options={{ headerShown: false, contentStyle: { backgroundColor: screenBackground } }} />
					<Stack.Screen
						name='music/[id]'
						options={{
							presentation: 'transparentModal',
							headerShown: false,
							contentStyle: {
								backgroundColor: 'transparent',
							},
						}}
					/>
					<Stack.Screen name='_not-found' />
				</Stack>

				{currentSong && <MiniPlayer onPress={() => router.push(`/music/${currentSong.id}`)} />}
			</Animated.View>
		</Div>
	);
}

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const { setTracks, setAlbums, setArtists, setPlaylists, setRecentlyPlayed, setHasInitialized } = useLibraryStore();
	const initializePlayer = useAudioStore((state) => state.initializePlayer);
	const hydrateAppearance = useAppearanceStore((state) => state.hydrate);
	const hydrateDevSettings = useDevSettingsStore((state) => state.hydrate);
	const hydrateOfflineMode = useOfflineModeStore((state) => state.hydrate);
	const hydratePlaybackSettings = usePlaybackSettingsStore((state) => state.hydrate);

	useEffect(() => {
		const bg = Colors[colorScheme ?? 'dark'].background;
		SystemUI.setBackgroundColorAsync(bg);
	}, [colorScheme]);

	useEffect(() => {
		hydrateAppearance();
		hydrateDevSettings();
		hydrateOfflineMode();
		hydratePlaybackSettings();
	}, [hydrateAppearance, hydrateDevSettings, hydrateOfflineMode, hydratePlaybackSettings]);

	const hydratePodcast = usePodcastStore((s) => s.hydrate);
	const hydratePodcastProgress = usePodcastProgressStore((s) => s.hydrate);
	const hydratePodcastDownloads = usePodcastDownloadsStore((s) => s.hydrate);
	const hydrateMusicDownloads = useMusicDownloadsStore((s) => s.hydrate);
	useEffect(() => {
		hydratePodcastProgress();
		hydratePodcastDownloads();
		hydrateMusicDownloads();
		hydratePodcast().then(() => {
			const { feeds, fetchAllFeeds } = usePodcastStore.getState();
			if (feeds.length > 0) fetchAllFeeds();
		});
	}, [hydratePodcast, hydratePodcastProgress, hydratePodcastDownloads, hydrateMusicDownloads]);

	useEffect(() => {
		const init = async () => {
			try {
				// Try to load existing authentication state
				const authLoaded = await plexAuthService.loadAuthState();

				// Hydrate library BEFORE initializing player so saved queue IDs can resolve
				let hydrated = false;
				if (authLoaded && plexAuthService.isAuthenticated()) {
					console.log('✅ Using existing Plex authentication');
					const selectedServer = plexAuthService.getSelectedServer();
					if (selectedServer) {
						console.log(`📡 Connected to: ${selectedServer.name}`);
					}

					hydrated = await rehydrateLibraryStore();
					if (hydrated) {
						console.log('✅ Loaded cached library data - using cache, fresh fetch will happen in background');
						setHasInitialized(true);
					}
				}

				// Initialize audio player AFTER library hydration so saved queue IDs resolve correctly
				await initializePlayer();
				console.log('✅ Audio player initialized');

				setupCarPlay();

				if (authLoaded && plexAuthService.isAuthenticated()) {
					initScrobbleQueue().catch(() => {});

					const backgroundRefreshAll = () => {
						Promise.all([fetchAllTracks(), fetchAllAlbums(), fetchAllArtists(), fetchAllPlaylists(), fetchRecentlyPlayed(15)])
							.then(([tracks, albums, artists, playlists, recentlyPlayedSongs]) => {
								if (tracks.length > 0) setTracks(tracks);
								if (albums.length > 0) setAlbums(albums);
								if (artists.length > 0) setArtists(artists);
								if (playlists.length > 0) setPlaylists(playlists);
								if (recentlyPlayedSongs.length > 0) setRecentlyPlayed(recentlyPlayedSongs);
								console.log(`🔄 Background refresh complete: ${tracks.length} tracks`);
								InteractionManager.runAfterInteractions(() => {
									saveLibraryToCache().catch((err) => console.warn('Cache save failed:', err));
								});
							})
							.catch((err) => console.warn('⚠️ Background refresh failed:', err));
					};

					if (!hydrated) {
						Promise.all([fetchAllTracks(), fetchAllAlbums(), fetchAllArtists(), fetchAllPlaylists(), fetchRecentlyPlayed(15)])
							.then(([tracks, albums, artists, playlists, recentlyPlayedSongs]) => {
								if (tracks.length > 0) setTracks(tracks);
								if (albums.length > 0) setAlbums(albums);
								if (artists.length > 0) setArtists(artists);
								if (playlists.length > 0) setPlaylists(playlists);
								if (recentlyPlayedSongs.length > 0) setRecentlyPlayed(recentlyPlayedSongs);
								console.log(`✅ Initial fetch complete: ${tracks.length} tracks`);
								setHasInitialized(true);
								if (!useAudioStore.getState().currentSong) {
									useAudioStore
										.getState()
										.restorePlaybackState()
										.catch(() => {});
								}
								InteractionManager.runAfterInteractions(() => {
									saveLibraryToCache().catch((err) => console.warn('Cache save failed:', err));
								});
							})
							.catch((error) => {
								console.error('❌ Failed to fetch library:', error);
								setHasInitialized(true);
								testPlexServer().catch(() => {
									console.warn('⚠️ Cannot connect to Plex server');
								});
							});
					} else {
						// Cache loaded -- defer full refresh to background (5 min)
						setTimeout(backgroundRefreshAll, 5 * 60 * 1000);
					}
				} else {
					console.log('🔐 No existing authentication found. Please sign in through Settings.');
					setHasInitialized(true);
				}
			} catch (error) {
				console.error('Failed to initialize app:', error);
				setHasInitialized(true);
			}
		};

		init();
		return () => teardownCarPlay();
	}, []);

	return (
		<GestureHandlerRootView style={styles.container}>
			<SafeAreaProvider initialMetrics={initialWindowMetrics}>
				<ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
					<RootScaleProvider>
						<AudioSync />
						<AnimatedStack />
						<AddToPlaylistModal />
					</RootScaleProvider>
				</ThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
	},
	stackContainer: {
		flex: 1,
		overflow: 'hidden',
		borderRadius: 50,
	},
});
