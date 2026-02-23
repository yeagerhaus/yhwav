import { Stack } from 'expo-router';
import { useSearchStore } from '@/hooks';
import { useColors } from '@/hooks/useColors';

export default function SearchLayout() {
	const colors = useColors();

	return (
		<Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
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
					headerStyle: {
						backgroundColor: 'transparent',
					},
				}}
			/>
		</Stack>
	);
}
