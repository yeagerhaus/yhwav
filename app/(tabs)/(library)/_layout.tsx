import { Stack } from 'expo-router';
import { InternalHeader } from '@/components/Navigation/InternalHeader';
import { useColors } from '@/hooks/useColors';

export default function LibraryLayout() {
	// (Removed: "reset to root on tab re-tap" logic. It compared usePathname() against paths with route
	// groups, which expo-router strips, so it never ran.)
	const colors = useColors();

	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
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
					headerShown: true,
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
