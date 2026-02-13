import { ScrollView, StyleSheet } from 'react-native';
import SearchAlbumItem from '@/components/SearchItem/SearchAlbumItem';
import SearchArtistItem from '@/components/SearchItem/SearchArtistItem';
import SearchSongItem from '@/components/SearchItem/SearchSongItem';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSearch } from '@/hooks';
import type { Album, Artist, Song } from '@/types';

export default function SearchIndex() {
	const { query, searchResults, isSearching } = useSearch();

	if (!isSearching) {
		return (
			<ScrollView contentInsetAdjustmentBehavior='automatic'>
				<ThemedView style={styles.emptyState}>
					<ThemedText type='subtitle' style={styles.emptyText}>
						Search your library
					</ThemedText>
				</ThemedView>
			</ScrollView>
		);
	}

	const hasResults = searchResults.totalResults > 0;

	if (!hasResults) {
		return (
			<ScrollView contentInsetAdjustmentBehavior='automatic'>
				<ThemedView style={styles.emptyState}>
					<ThemedText type='subtitle' style={styles.emptyText}>
						No results for "{query}"
					</ThemedText>
				</ThemedView>
			</ScrollView>
		);
	}

	return (
		<ScrollView contentInsetAdjustmentBehavior='automatic' keyboardDismissMode='on-drag'>
			<ThemedView style={styles.container}>
				{searchResults.artists.length > 0 && (
					<ThemedView style={styles.section}>
						<ThemedText type='defaultSemiBold' style={styles.sectionTitle}>
							Artists
						</ThemedText>
						{searchResults.artists.map((result) => {
							const artist = result.item as Artist;
							return <SearchArtistItem key={artist.key} artist={artist} query={query} />;
						})}
					</ThemedView>
				)}

				{searchResults.albums.length > 0 && (
					<ThemedView style={styles.section}>
						<ThemedText type='defaultSemiBold' style={styles.sectionTitle}>
							Albums
						</ThemedText>
						{searchResults.albums.map((result) => {
							const album = result.item as Album;
							return <SearchAlbumItem key={album.id} album={album} query={query} />;
						})}
					</ThemedView>
				)}

				{searchResults.songs.length > 0 && (
					<ThemedView style={styles.section}>
						<ThemedText type='defaultSemiBold' style={styles.sectionTitle}>
							Songs
						</ThemedText>
						{searchResults.songs.map((result) => {
							const song = result.item as Song;
							return <SearchSongItem key={song.id} song={song} query={query} />;
						})}
					</ThemedView>
				)}
			</ThemedView>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 16,
		paddingTop: 8,
		paddingBottom: 120,
	},
	emptyState: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingTop: 80,
	},
	emptyText: {
		opacity: 0.5,
	},
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 20,
		marginBottom: 12,
	},
});
