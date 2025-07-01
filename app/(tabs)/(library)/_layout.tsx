import { InternalHeader } from '@/cmps/navigation/InternalHeader';
import { Stack, usePathname } from 'expo-router';

export default function LibraryLayout() {
	const currentScreen = usePathname();
return (
	<Stack>
		<Stack.Screen
			name='(artists)'
			options={{
				title: 'Artists',
				headerBackTitle: 'Back',
				headerTintColor: '#FA2D48',
				headerTitleStyle: { color: '#FFFFFF' },
				header: () => <InternalHeader title='Artists' />,
			}}
		/>
		<Stack.Screen
			name='(albums)'
			options={{
				title: 'Albums',
				headerBackTitle: 'Back',
				headerTintColor: '#FA2D48',
				headerTitleStyle: { color: '#FFFFFF' },
				header: () => <InternalHeader title='Albums' />,
			}}
		/>
		<Stack.Screen
			name='songs'
			options={{
				title: 'Songs',
				headerBackTitle: 'Back',
				headerTintColor: '#FA2D48',
				headerTitleStyle: { color: '#FFFFFF' },
				header: () => <InternalHeader title='Songs' />,
			}}
		/>
		<Stack.Screen
			name='(playlists)'
			options={{
				title: 'Playlists',
				headerBackTitle: 'Back',
				headerTintColor: '#FA2D48',
				headerTitleStyle: { color: '#FFFFFF' },
				header: () => <InternalHeader title='Playlists' />,
			}}
		/>
	</Stack>
);
}