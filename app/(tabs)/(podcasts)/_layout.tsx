import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { InternalHeader } from '@/components/navigation/InternalHeader';
import { Colors } from '@/constants';

export default function PodcastsLayout() {
	const colorScheme = useColorScheme();
	const bg = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;

	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
			<Stack.Screen name='index' />
			<Stack.Screen
				name='[feedId]'
				options={{
					headerShown: true,
					title: 'Show',
					header: () => <InternalHeader />,
				}}
			/>
			<Stack.Screen
				name='episode/[episodeId]'
				options={{
					headerShown: true,
					title: 'Episode',
					header: () => <InternalHeader />,
				}}
			/>
		</Stack>
	);
}
