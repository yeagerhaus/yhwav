import { Stack } from 'expo-router';
import { InternalHeader } from '@/cmps/navigation/InternalHeader';

export default function LibraryLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
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
