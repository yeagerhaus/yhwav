import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants';
import { useSearchStore } from '@/hooks';

export default function SearchLayout() {
	const colorScheme = useColorScheme();
	const bg = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;

	return (
		<Stack screenOptions={{ contentStyle: { backgroundColor: bg } }}>
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
