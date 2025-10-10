import { Stack, usePathname } from 'expo-router';
import { InternalHeader } from '@/cmps/navigation/InternalHeader';

export default function LibraryLayout() {
	const _currentScreen = usePathname();
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen
				name='(artists)'
				options={{
					title: 'Artists',
					header: () => <InternalHeader title='Artists' />,
				}}
			/>
			<Stack.Screen
				name='(albums)'
				options={{
					title: 'Albums',
					header: () => <InternalHeader title='Albums' />,
				}}
			/>
			<Stack.Screen
				name='songs'
				options={{
					title: 'Songs',
					header: () => <InternalHeader title='Songs' />,
				}}
			/>
			<Stack.Screen
				name='(playlists)'
				options={{
					title: 'Playlists',
					header: () => <InternalHeader title='Playlists' />,
				}}
			/>
		</Stack>
	);
}
