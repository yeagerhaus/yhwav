import { StyleSheet } from 'react-native';
import SearchResults from '@/cmps/SearchResults';
import { ThemedView } from '@/cmps/ThemedView';
import { useSearch } from '@/hooks/useSearch';

export default function SearchIndex() {
	const { query, searchResults } = useSearch();

	console.log('🔍 SearchIndex - query:', query, 'totalResults:', searchResults.totalResults);

	return (
		<ThemedView style={styles.container}>
			<SearchResults query={query} searchResults={searchResults} />
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
