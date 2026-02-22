import { Stack, useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { InternalHeader } from '@/components/navigation/InternalHeader';
import { Colors } from '@/constants';

export default function SettingsLayout() {
	const router = useRouter();
	const pathname = usePathname();
	const lastPathnameRef = useRef<string>('');
	const colorScheme = useColorScheme();
	const bg = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;

	useFocusEffect(
		useCallback(() => {
			const isHomeScreen = pathname === '/(tabs)/(settings)' || pathname === '/(tabs)/(settings)/';
			const isNestedRoute = pathname.startsWith('/(tabs)/(settings)/') && !isHomeScreen;

			if (isNestedRoute && pathname !== lastPathnameRef.current) {
				lastPathnameRef.current = pathname;
				const timeoutId = setTimeout(() => {
					router.replace('/(tabs)/(settings)');
				}, 200);
				return () => clearTimeout(timeoutId);
			}

			if (isHomeScreen) {
				lastPathnameRef.current = '';
			}
		}, [pathname, router]),
	);

	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
			<Stack.Screen name='index' />
			<Stack.Screen
				name='account'
				options={{
					headerShown: true,
					title: 'Account & Server',
					header: () => <InternalHeader />,
				}}
			/>
			<Stack.Screen
				name='storage'
				options={{
					headerShown: true,
					title: 'Storage & Data',
					header: () => <InternalHeader />,
				}}
			/>
			<Stack.Screen
				name='appearance'
				options={{
					headerShown: true,
					title: 'Appearance',
					header: () => <InternalHeader />,
				}}
			/>
			<Stack.Screen
				name='playback'
				options={{
					headerShown: true,
					title: 'Playback',
					header: () => <InternalHeader />,
				}}
			/>
			<Stack.Screen
				name='developer'
				options={{
					headerShown: true,
					title: 'Developer',
					header: () => <InternalHeader />,
				}}
			/>
		</Stack>
	);
}
