import { ScrollView, StyleSheet } from 'react-native';
import { Div } from '@/components/Div';
import SearchAlbumItem from '@/components/SearchItem/SearchAlbumItem';
import SearchArtistItem from '@/components/SearchItem/SearchArtistItem';
import SearchPlaylistItem from '@/components/SearchItem/SearchPlaylistItem';
import SearchSongItem from '@/components/SearchItem/SearchSongItem';
import { ThemedText } from '@/components/ThemedText';
import { useSearch } from '@/hooks';
import type { Album, Artist, Playlist, Song } from '@/types';

export default function SearchIndex() {
	const { query, searchResults, isSearching } = useSearch();

	if (!isSearching) {
		return (
			<ScrollView contentInsetAdjustmentBehavior='automatic'>
				<Div style={styles.emptyState}>
					<ThemedText type='subtitle' style={styles.emptyText}>
						Search your library
					</ThemedText>
				</Div>
			</ScrollView>
		);
	}

	const hasResults = searchResults.totalResults > 0;

	if (!hasResults) {
		return (
			<ScrollView contentInsetAdjustmentBehavior='automatic'>
				<Div style={styles.emptyState}>
					<ThemedText type='subtitle' style={styles.emptyText}>
						No results for "{query}"
					</ThemedText>
				</Div>
			</ScrollView>
		);
	}

	return (
		<ScrollView contentInsetAdjustmentBehavior='automatic' keyboardDismissMode='on-drag'>
			<Div style={styles.container}>
				{searchResults.playlists.length > 0 && (
					<Div style={styles.section}>
						<ThemedText type='defaultSemiBold' style={styles.sectionTitle}>
							Playlists
						</ThemedText>
						{searchResults.playlists.map((result) => {
							const playlist = result.item as Playlist;
							return <SearchPlaylistItem key={playlist.id} playlist={playlist} query={query} />;
						})}
					</Div>
				)}

				{searchResults.artists.length > 0 && (
					<Div style={styles.section}>
						<ThemedText type='defaultSemiBold' style={styles.sectionTitle}>
							Artists
						</ThemedText>
						{searchResults.artists.map((result) => {
							const artist = result.item as Artist;
							return <SearchArtistItem key={artist.key} artist={artist} query={query} />;
						})}
					</Div>
				)}

				{searchResults.albums.length > 0 && (
					<Div style={styles.section}>
						<ThemedText type='defaultSemiBold' style={styles.sectionTitle}>
							Albums
						</ThemedText>
						{searchResults.albums.map((result) => {
							const album = result.item as Album;
							return <SearchAlbumItem key={album.id} album={album} query={query} />;
						})}
					</Div>
				)}

				{searchResults.songs.length > 0 && (
					<Div style={styles.section}>
						<ThemedText type='defaultSemiBold' style={styles.sectionTitle}>
							Songs
						</ThemedText>
						{searchResults.songs.map((result) => {
							const song = result.item as Song;
							return <SearchSongItem key={song.id} song={song} query={query} />;
						})}
					</Div>
				)}
			</Div>
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
