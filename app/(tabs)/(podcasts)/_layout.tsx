import { Stack } from 'expo-router';
import { InternalHeader } from '@/components/Navigation/InternalHeader';
import { useColors } from '@/hooks/useColors';

export default function PodcastsLayout() {
	const colors = useColors();

	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
			<Stack.Screen name='index' />
			<Stack.Screen
				name='search'
				options={{
					headerShown: false,
					presentation: 'modal',
				}}
			/>
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
