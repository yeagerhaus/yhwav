import { InternalHeader } from '@/components/navigation/InternalHeader';
import { Stack } from 'expo-router';

export default function PodcastsLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name='index' />
			<Stack.Screen
				name="[feedId]"
				options={{
					headerShown: true,
					title: 'Show',
					header: () => <InternalHeader />,
				}}
			/>
		</Stack>
	);
}
