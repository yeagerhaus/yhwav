// Crypto polyfills removed - using expo-crypto instead
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef } from 'react';
import { AppState, InteractionManager, LogBox, StyleSheet, useColorScheme } from 'react-native';

LogBox.ignoreAllLogs();

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { AddToPlaylistModal, Div, MiniPlayer, SplashOverlay } from '@/components';
import { Colors } from '@/constants';
import { RootScaleProvider, useRootScale } from '@/ctx/RootScaleContext';
import { useAddToPlaylist } from '@/hooks/useAddToPlaylist';
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
import { rehydrateLibraryStore, saveLibraryToCache } from '@/utils';
import '@/utils/background-fetch-task';
import { hasSeenNotificationPrompt } from '@/app/notification-prompt';
import { registerBackgroundFetch } from '@/utils/background-fetch-task';
import { addNotificationResponseListener, setupNotificationHandler } from '@/utils/notifications';
import {
	fetchAllAlbums,
	fetchAllArtists,
	fetchAllPlaylists,
	fetchAllTracks,
	fetchRecentlyPlayed,
	plexClient,
	testPlexServer,
} from '@/utils/plex';
import { plexAuthService } from '@/utils/plex-auth';
import { initScrobbleQueue } from '@/utils/scrobble-queue';

setupNotificationHandler();

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
					<Stack.Screen
						name='notification-prompt'
						options={{
							presentation: 'transparentModal',
							headerShown: false,
							animation: 'fade',
							contentStyle: { backgroundColor: 'transparent' },
						}}
					/>
					<Stack.Screen name='_not-found' />
				</Stack>

				{currentSong && <MiniPlayer />}
			</Animated.View>
		</Div>
	);
}

const LIBRARY_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const router = useRouter();
	const { setTracks, setAlbums, setArtists, setPlaylists, setRecentlyPlayed, setHasInitialized } = useLibraryStore();
	const initializePlayer = useAudioStore((state) => state.initializePlayer);
	const hydrateAppearance = useAppearanceStore((state) => state.hydrate);
	const hydrateDevSettings = useDevSettingsStore((state) => state.hydrate);
	const hydrateOfflineMode = useOfflineModeStore((state) => state.hydrate);
	const hydratePlaybackSettings = usePlaybackSettingsStore((state) => state.hydrate);
	const addToPlaylistVisible = useAddToPlaylist((s) => s.visible);
	const plexAuthReady = useRef(false);

	useEffect(() => {
		registerBackgroundFetch().catch((err) => console.warn('Background fetch registration failed:', err));
		if (!hasSeenNotificationPrompt()) {
			const handle = requestAnimationFrame(() => router.push('/notification-prompt'));
			const sub = addNotificationResponseListener(router);
			return () => {
				cancelAnimationFrame(handle);
				sub.remove();
			};
		}
		const sub = addNotificationResponseListener(router);
		return () => sub.remove();
	}, [router]);

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
		hydratePodcast();
		const { feeds, fetchAllFeeds } = usePodcastStore.getState();
		if (feeds.length > 0) fetchAllFeeds();
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

					hydrated = rehydrateLibraryStore();
					if (hydrated) {
						console.log('✅ Loaded cached library data - using cache, fresh fetch will happen in background');
						setHasInitialized(true);
					}
				}

				// Initialize audio player AFTER library hydration so saved queue IDs resolve correctly
				await initializePlayer();
				console.log('✅ Audio player initialized');

				if (authLoaded && plexAuthService.isAuthenticated()) {
					plexAuthReady.current = true;
					initScrobbleQueue().catch(() => {});

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
									saveLibraryToCache();
								});
							})
							.catch((error) => {
								console.error('❌ Failed to fetch library:', error);
								setHasInitialized(true);
								testPlexServer().catch(() => {
									console.warn('⚠️ Cannot connect to Plex server');
								});
							});
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

		const appStateSub = AppState.addEventListener('change', (state) => {
			if (state === 'active' && plexAuthReady.current) {
				plexClient.refreshConnectionIfNeeded().catch(() => {});
			}
		});

		return () => appStateSub.remove();
	}, []);

	useEffect(() => {
		const interval = setInterval(() => {
			if (!plexAuthReady.current) return;
			if (useOfflineModeStore.getState().offlineMode) return;

			Promise.all([fetchAllTracks(), fetchAllAlbums(), fetchAllArtists(), fetchAllPlaylists(), fetchRecentlyPlayed(15)])
				.then(([tracks, albums, artists, playlists, recentlyPlayedSongs]) => {
					if (tracks.length > 0) setTracks(tracks);
					if (albums.length > 0) setAlbums(albums);
					if (artists.length > 0) setArtists(artists);
					if (playlists.length > 0) setPlaylists(playlists);
					if (recentlyPlayedSongs.length > 0) setRecentlyPlayed(recentlyPlayedSongs);
					console.log(`🔄 Periodic refresh complete: ${tracks.length} tracks`);
					InteractionManager.runAfterInteractions(() => {
						saveLibraryToCache();
					});
				})
				.catch((err) => console.warn('⚠️ Periodic refresh failed:', err));
		}, LIBRARY_REFRESH_INTERVAL);

		return () => clearInterval(interval);
	}, [setTracks, setAlbums, setArtists, setPlaylists, setRecentlyPlayed]);

	return (
		<GestureHandlerRootView style={styles.container}>
			<SafeAreaProvider initialMetrics={initialWindowMetrics}>
				<ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
					<RootScaleProvider>
						<AudioSync />
						<AnimatedStack />
						{addToPlaylistVisible && <AddToPlaylistModal />}
					</RootScaleProvider>
				</ThemeProvider>
			</SafeAreaProvider>
			<SplashOverlay />
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
