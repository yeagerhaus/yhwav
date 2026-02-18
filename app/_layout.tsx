// Crypto polyfills removed - using expo-crypto instead
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { InteractionManager, LogBox, StyleSheet, useColorScheme } from 'react-native';

LogBox.ignoreAllLogs();

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { AddToPlaylistModal, Div, MiniPlayer } from '@/components';
import { PerformanceDebugger } from '@/components/PerformanceDebugger';
import { Colors } from '@/constants';
import { RootScaleProvider, useRootScale } from '@/ctx/RootScaleContext';
import { useAudioStore, useTrackPlayerSync } from '@/hooks/useAudioStore';
import { useDevSettingsStore } from '@/hooks/useDevSettingsStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { usePlaybackSettingsStore } from '@/hooks/usePlaybackSettingsStore';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { usePodcastDownloadsStore } from '@/hooks/usePodcastDownloadsStore';
import { usePodcastProgressStore } from '@/hooks/usePodcastProgressStore';
import { usePodcastStore } from '@/hooks/usePodcastStore';
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
	const { scale } = useRootScale();
	const router = useRouter();
	const colorScheme = useColorScheme();
	const currentSong = useAudioStore((state) => state.currentSong);
	const screenBackground = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;

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
	const { setTracks, setAlbums, setArtists, setPlaylists, setRecentlyPlayed } = useLibraryStore();
	const initializePlayer = useAudioStore((state) => state.initializePlayer);
	const showPerformanceDebugger = useDevSettingsStore((state) => state.showPerformanceDebugger);
	const hydrateDevSettings = useDevSettingsStore((state) => state.hydrate);
	const hydrateOfflineMode = useOfflineModeStore((state) => state.hydrate);
	const hydratePlaybackSettings = usePlaybackSettingsStore((state) => state.hydrate);

	useEffect(() => {
		const bg = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;
		SystemUI.setBackgroundColorAsync(bg);
	}, [colorScheme]);

	useEffect(() => {
		hydrateDevSettings();
		hydrateOfflineMode();
		hydratePlaybackSettings();
	}, [hydrateDevSettings, hydrateOfflineMode, hydratePlaybackSettings]);

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
					}
				}

				// Initialize audio player AFTER library hydration so saved queue IDs resolve correctly
				await initializePlayer();
				console.log('✅ Audio player initialized');

				if (authLoaded && plexAuthService.isAuthenticated()) {
					initScrobbleQueue().catch(() => {});

					const fetchAlbumsAndArtists = () => {
						fetchAllAlbums()
							.then((albums) => setAlbums(albums))
							.catch((err) => console.warn('⚠️ Failed to fetch albums:', err));
						fetchAllArtists()
							.then((artists) => setArtists(artists))
							.catch((err) => console.warn('⚠️ Failed to fetch artists:', err));
						fetchAllPlaylists()
							.then((playlists) => setPlaylists(playlists))
							.catch((err) => console.warn('⚠️ Failed to fetch playlists:', err));
						fetchRecentlyPlayed(25)
							.then((songs) => setRecentlyPlayed(songs))
							.catch((err) => console.warn('⚠️ Failed to fetch recently played:', err));
					};

					// Only fetch fresh tracks if we don't have cache, or do it much later in background
					if (!hydrated) {
						// No cache - fetch immediately
						fetchAlbumsAndArtists();
						fetchAllTracks()
							.then((fetchedTracks) => {
								if (fetchedTracks.length > 0) {
									console.log(`✅ Fetched ${fetchedTracks.length} tracks`);
									setTracks(fetchedTracks);
									// Retry playback restoration: initial restore may have failed
									// because the library wasn't cached when initializePlayer ran.
									if (!useAudioStore.getState().currentSong) {
										useAudioStore
											.getState()
											.restorePlaybackState()
											.catch(() => {});
									}
									// Defer cache save so the UI renders before JSON.stringify blocks
									InteractionManager.runAfterInteractions(() => {
										saveLibraryToCache().catch((err) => console.warn('Cache save failed:', err));
									});
								}
							})
							.catch((error) => {
								console.error('❌ Failed to fetch tracks:', error);
								testPlexServer().catch(() => {
									console.warn('⚠️ Cannot connect to Plex server');
								});
							});
					} else {
						// We have cache for tracks - but albums/artists aren't cached, fetch now
						fetchAlbumsAndArtists();
						// Fetch fresh track data in background much later (5 minutes)
						// This prevents the double-loading issue
						setTimeout(
							() => {
								fetchAllTracks()
									.then((fetchedTracks) => {
										if (fetchedTracks.length > 0) {
											console.log(`🔄 Background refresh: Fetched ${fetchedTracks.length} tracks`);
											setTracks(fetchedTracks);
											InteractionManager.runAfterInteractions(() => {
												saveLibraryToCache().catch((err) => console.warn('Cache save failed:', err));
											});
										}
									})
									.catch((error) => {
										console.warn('⚠️ Background refresh failed (using cache):', error);
									});
							},
							5 * 60 * 1000,
						); // 5 minutes - user won't notice
					}
				} else {
					console.log('🔐 No existing authentication found. Please sign in through Settings.');
				}
			} catch (error) {
				console.error('Failed to initialize app:', error);
				// Don't block app startup - user can authenticate in Settings
			}
		};

		init();
	}, []);

	return (
		<GestureHandlerRootView style={styles.container}>
			<ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
				<RootScaleProvider>
					<AudioSync />
					<AnimatedStack />
					<AddToPlaylistModal />
					{__DEV__ && showPerformanceDebugger && <PerformanceDebugger />}
				</RootScaleProvider>
			</ThemeProvider>
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
