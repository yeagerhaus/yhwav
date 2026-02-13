import { Stack } from 'expo-router';
import { useSearchStore } from '@/hooks';

export default function SearchLayout() {
	return (
		<Stack>
			<Stack.Screen
				name='index'
				options={{
					title: 'Search',
					headerSearchBarOptions: {
						placement: 'automatic',
						placeholder: 'Search',
						onChangeText: (event) => {
							useSearchStore.getState().setQuery(event.nativeEvent.text);
						},
					},
				}}
			/>
		</Stack>
	);
}
