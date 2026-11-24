import { Stack } from 'expo-router';
import { InternalHeader } from '@/components/Navigation/InternalHeader';
import { useColors } from '@/hooks/useColors';

export default function SettingsLayout() {
	// (Removed: "reset to root on tab re-tap" logic. It compared usePathname() against paths with route
	// groups, which expo-router strips, so it never ran.)
	const colors = useColors();

	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
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
