import { Stack } from 'expo-router';
import { SearchProvider, useSearchContext } from '@/ctx/SearchContext';

function SearchLayoutContent() {
	const { setQuery } = useSearchContext();

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
					headerShown: false,
				}}
			/>
		</Stack>
	);
}

export default function SearchLayout() {
	return (
		<SearchProvider>
			<SearchLayoutContent />
		</SearchProvider>
	);
}
