import { Stack } from 'expo-router';
import { InternalHeader } from '@/components/navigation/InternalHeader';

export default function PodcastsLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name='index' />
			<Stack.Screen
				name='[feedId]'
				options={{
					headerShown: true,
					title: 'Show',
					header: () => <InternalHeader />,
				}}
			/>
		</Stack>
	);
}
