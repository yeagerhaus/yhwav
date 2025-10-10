import { Stack } from 'expo-router';
import { useSearch } from '@/hooks/useSearch';

export default function SearchLayout() {
	const { setQuery } = useSearch();

	const handleSearchChange = (event: any) => {
		const text = event.nativeEvent.text;
		setQuery(text);
	};

	return (
		<Stack>
			<Stack.Screen
				name='index'
				options={{
					title: 'Search',
					headerSearchBarOptions: {
						placement: 'automatic',
						placeholder: 'Search songs, albums, artists...',
						onChangeText: handleSearchChange,
					},
				}}
			/>
		</Stack>
	);
}
