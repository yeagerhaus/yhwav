// Crypto polyfills removed - using expo-crypto instead
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { MiniPlayer } from '@/components';
import { RootScaleProvider, useRootScale } from '@/ctx/RootScaleContext';
import { useAudioStore, useTrackPlayerSync } from '@/hooks/useAudioStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { rehydrateLibraryStore, saveLibraryToCache } from '@/utils';
import { fetchAllTracks, initializePlexJWT, testPlexServer } from '@/utils/plex';
import { plexAuthService } from '@/utils/plex-auth';

function AudioSync() {
	useTrackPlayerSync();
	return null;
}

function AnimatedStack() {
	const { scale } = useRootScale();
	const router = useRouter();
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
		<View style={{ flex: 1 }}>
			<Animated.View style={[styles.stackContainer, animatedStyle]}>
				<Stack>
					<Stack.Screen name='(tabs)' options={{ headerShown: false }} />
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
		</View>
	);
}

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const { setTracks, setLibraryLoading } = useLibraryStore();
	const initializePlayer = useAudioStore((state) => state.initializePlayer);

	useEffect(() => {
		const init = async () => {
			setLibraryLoading(true);

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
				} else {
					console.log('🔐 No existing authentication, using fallback method');
					// Fallback to JWT authentication
					await initializePlexJWT();
					console.log('Plex JWT authentication initialized');
				}

				// Test Plex server connectivity
				console.log('Testing Plex server connectivity...');
				const isServerAccessible = await testPlexServer();
				if (!isServerAccessible) {
					throw new Error(
						'Cannot connect to Plex server. Please check your server configuration or go to Settings to authenticate.',
					);
				}
				console.log('Plex server connectivity verified');

				const hydrated = await rehydrateLibraryStore();
				if (!hydrated) {
					const fetchedTracks = await fetchAllTracks();
					console.log('Fetched sample track:', fetchedTracks[0]);
					console.log('Setting tracks in Zustand store...');
					await setTracks(fetchedTracks);
					await new Promise((resolve) => setTimeout(resolve, 10)); // allow flush
					await saveLibraryToCache();
				}
			} catch (error) {
				console.error('Failed to initialize app:', error);
			} finally {
				setLibraryLoading(false);
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
