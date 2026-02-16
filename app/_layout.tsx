// Crypto polyfills removed - using expo-crypto instead
import { DarkTheme, DefaultTheme, ThemeProvider, useTheme } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { InteractionManager, StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { AddToPlaylistModal, Div, MiniPlayer } from '@/components';
import { PerformanceDebugger } from '@/components/PerformanceDebugger';
import { RootScaleProvider, useRootScale } from '@/ctx/RootScaleContext';
import { useAudioStore, useTrackPlayerSync } from '@/hooks/useAudioStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { rehydrateLibraryStore, saveLibraryToCache } from '@/utils';
import { fetchAllAlbums, fetchAllArtists, fetchAllPlaylists, fetchAllTracks, fetchRecentlyPlayed, testPlexServer } from '@/utils/plex';
import { plexAuthService } from '@/utils/plex-auth';

function AudioSync() {
	useTrackPlayerSync();
	return null;
}

function AnimatedStack() {
	const { scale } = useRootScale();
	const router = useRouter();
	const { colors } = useTheme();
	const currentSong = useAudioStore((state) => state.currentSong);

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
		<Div style={{ flex: 1, backgroundColor: 'transparent' }}>
			<Animated.View style={[styles.stackContainer, animatedStyle]}>
				<Stack>
					<Stack.Screen name='(tabs)' options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
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

	useEffect(() => {
		const init = async () => {
			try {
				// Initialize audio player first
				await initializePlayer();
				console.log('✅ Audio player initialized');

				// Try to load existing authentication state
				const authLoaded = await plexAuthService.loadAuthState();

				if (authLoaded && plexAuthService.isAuthenticated()) {
					console.log('✅ Using existing Plex authentication');
					const selectedServer = plexAuthService.getSelectedServer();
					if (selectedServer) {
						console.log(`📡 Connected to: ${selectedServer.name}`);
					}

					// Load cached data first (for instant UI)
					const hydrated = await rehydrateLibraryStore();
					if (hydrated) {
						console.log('✅ Loaded cached library data - using cache, fresh fetch will happen in background');
					}

					// Fetch albums, artists, playlists & recently played immediately (small payloads, no caching needed)
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
			<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
				<RootScaleProvider>
					<AudioSync />
					<AnimatedStack />
					<AddToPlaylistModal />
					<PerformanceDebugger />
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
