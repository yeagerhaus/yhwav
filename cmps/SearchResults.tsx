import { ScrollView, StyleSheet, View } from 'react-native';
import { SearchAlbumItem, SearchArtistItem, SearchSongItem } from '@/cmps/SearchItem';
import { ThemedText } from '@/cmps/ThemedText';
import { ThemedView } from '@/cmps/ThemedView';
import type { SearchResult, SearchResults as SearchResultsType } from '@/hooks/useSearch';
import type { Album, Artist, Song } from '@/types';

interface SearchResultsProps {
	query: string;
	searchResults: SearchResultsType;
}

export default function SearchResults({ query, searchResults }: SearchResultsProps) {
	console.log('🔍 SearchResults component called!', {
		query,
		totalResults: searchResults.totalResults,
		hasSongs: searchResults.songs.length > 0,
		hasAlbums: searchResults.albums.length > 0,
		hasArtists: searchResults.artists.length > 0,
	});

	// Debug: Check if we have any results at all
	if (searchResults.totalResults > 0) {
		console.log('🔍 SearchResults - We have results!', searchResults);
		console.log('🔍 SearchResults - First song:', searchResults.songs[0]);
		console.log('🔍 SearchResults - First album:', searchResults.albums[0]);
		console.log('🔍 SearchResults - First artist:', searchResults.artists[0]);
	} else {
		console.log('🔍 SearchResults - No results, query:', query);
	}

	if (searchResults.totalResults === 0) {
		if (!query.trim()) {
			return (
				<ThemedView style={styles.emptyContainer}>
					<ThemedText type='subtitle' style={styles.emptyText}>
						Search for songs, albums, or artists
					</ThemedText>
				</ThemedView>
			);
		} else {
			return (
				<ThemedView style={styles.emptyContainer}>
					<ThemedText type='subtitle' style={styles.emptyText}>
						No results found for "{query}"
					</ThemedText>
				</ThemedView>
			);
		}
	}

	const renderSection = (title: string, results: SearchResult[], type: 'song' | 'album' | 'artist') => {
		if (results.length === 0) return null;

		return (
			<View key={type} style={styles.section}>
				<ThemedText type='defaultSemiBold' style={styles.sectionTitle}>
					{title} ({results.length})
				</ThemedText>
				<View style={styles.sectionContent}>
					{results.map((result) => {
						switch (type) {
							case 'song':
								return <SearchSongItem key={(result.item as Song).id} song={result.item as Song} query={query} />;
							case 'album':
								return <SearchAlbumItem key={(result.item as Album).id} album={result.item as Album} query={query} />;
							case 'artist':
								return <SearchArtistItem key={(result.item as Artist).key} artist={result.item as Artist} query={query} />;
							default:
								return null;
						}
					})}
				</View>
			</View>
		);
	};

	console.log('🔍 SearchResults - Rendering results:', {
		songs: searchResults.songs.length,
		albums: searchResults.albums.length,
		artists: searchResults.artists.length,
		total: searchResults.totalResults,
	});

	return (
		<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
			<ThemedView style={styles.header}>
				<ThemedText type='defaultSemiBold' style={styles.resultsCount}>
					{searchResults.totalResults} result{searchResults.totalResults !== 1 ? 's' : ''} for "{query}"
				</ThemedText>
			</ThemedView>

			{/* Debug info */}
			<ThemedView style={{ padding: 16, backgroundColor: 'rgba(0,255,0,0.1)' }}>
				<ThemedText style={{ color: 'green', fontSize: 12 }}>
					DEBUG: Songs: {searchResults.songs.length}, Albums: {searchResults.albums.length}, Artists:{' '}
					{searchResults.artists.length}
				</ThemedText>
			</ThemedView>

			{/* Test render - always show this if we have results */}
			{searchResults.totalResults > 0 && (
				<ThemedView style={{ padding: 16, backgroundColor: 'rgba(255,0,0,0.2)' }}>
					<ThemedText style={{ color: 'red', fontSize: 16, fontWeight: 'bold' }}>
						🎉 SEARCH RESULTS FOUND! This should be visible!
					</ThemedText>
				</ThemedView>
			)}

			{renderSection('Songs', searchResults.songs, 'song')}
			{renderSection('Albums', searchResults.albums, 'album')}
			{renderSection('Artists', searchResults.artists, 'artist')}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: '#333',
	},
	resultsCount: {
		fontSize: 16,
		opacity: 0.7,
	},
	section: {
		marginTop: 16,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '600',
		paddingHorizontal: 16,
		marginBottom: 8,
	},
	sectionContent: {
		paddingHorizontal: 16,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
	},
	emptyText: {
		fontSize: 16,
		opacity: 0.6,
		textAlign: 'center',
	},
});
