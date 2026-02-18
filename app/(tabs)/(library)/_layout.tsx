import { Stack, useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { InternalHeader } from '@/components/navigation/InternalHeader';
import { Colors } from '@/constants';

export default function LibraryLayout() {
	const router = useRouter();
	const pathname = usePathname();
	const lastPathnameRef = useRef<string>('');
	const colorScheme = useColorScheme();
	const bg = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;

	// Navigate to home screen when library tab is focused and we're on a nested route
	// This handles the case when user presses the library tab icon while on a nested route
	useFocusEffect(
		useCallback(() => {
			// Check if we're on a nested route (not the home screen)
			const isHomeScreen = pathname === '/(tabs)/(library)' || pathname === '/(tabs)/(library)/';
			const isNestedRoute = pathname.startsWith('/(tabs)/(library)/') && !isHomeScreen;

			// Only navigate if:
			// 1. We're on a nested route
			// 2. The pathname has changed (to avoid navigating on every focus)
			// 3. We haven't just navigated to this route
			if (isNestedRoute && pathname !== lastPathnameRef.current) {
				lastPathnameRef.current = pathname;
				// Small delay to allow tab navigation to complete
				const timeoutId = setTimeout(() => {
					router.replace('/(tabs)/(library)');
				}, 200);
				return () => clearTimeout(timeoutId);
			}

			// Reset ref when we're on the home screen
			if (isHomeScreen) {
				lastPathnameRef.current = '';
			}
		}, [pathname, router]),
	);

	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
			<Stack.Screen name='index' />
			<Stack.Screen
				name='(artists)'
				options={{
					title: 'Artists',
					header: () => <InternalHeader />,
				}}
			/>
			<Stack.Screen
				name='(albums)'
				options={{
					title: 'Albums',
					header: () => <InternalHeader />,
				}}
			/>
			<Stack.Screen
				name='songs'
				options={{
					title: 'Songs',
					header: () => <InternalHeader />,
				}}
			/>
			<Stack.Screen
				name='(playlists)'
				options={{
					title: 'Playlists',
					header: () => <InternalHeader />,
				}}
			/>
		</Stack>
	);
}
