import { ScrollView, StyleSheet } from 'react-native';
import { Div, SearchAlbumItem, SearchArtistItem, SearchPlaylistItem, SearchSongItem, Text } from '@/components';
import { useSearch } from '@/hooks';
import type { Album, Artist, Playlist, Song } from '@/types';

export default function SearchIndex() {
	const { query, searchResults, isSearching } = useSearch();

	if (!isSearching) {
		return (
			<ScrollView contentInsetAdjustmentBehavior='automatic'>
				<Div transparent style={styles.emptyState}>
					<Text type='bodySM' style={styles.emptyText}>
						Search your library
					</Text>
				</Div>
			</ScrollView>
		);
	}

	const hasResults = searchResults.totalResults > 0;

	if (!hasResults) {
		return (
			<ScrollView contentInsetAdjustmentBehavior='automatic'>
				<Div transparent style={styles.emptyState}>
					<Text type='bodySM' style={styles.emptyText}>
						No results for "{query}"
					</Text>
				</Div>
			</ScrollView>
		);
	}

	return (
		<ScrollView contentInsetAdjustmentBehavior='automatic' keyboardDismissMode='on-drag'>
			<Div transparent style={styles.container}>
				{searchResults.playlists.length > 0 && (
					<Div transparent style={styles.section}>
						<Text type='h3' style={styles.sectionTitle}>
							Playlists
						</Text>
						{searchResults.playlists.map((result) => {
							const playlist = result.item as Playlist;
							return <SearchPlaylistItem key={playlist.id} playlist={playlist} query={query} />;
						})}
					</Div>
				)}

				{searchResults.artists.length > 0 && (
					<Div transparent style={styles.section}>
						<Text type='h3' style={styles.sectionTitle}>
							Artists
						</Text>
						{searchResults.artists.map((result) => {
							const artist = result.item as Artist;
							return <SearchArtistItem key={artist.key} artist={artist} query={query} />;
						})}
					</Div>
				)}

				{searchResults.albums.length > 0 && (
					<Div transparent style={styles.section}>
						<Text type='h3' style={styles.sectionTitle}>
							Albums
						</Text>
						{searchResults.albums.map((result) => {
							const album = result.item as Album;
							return <SearchAlbumItem key={album.id} album={album} query={query} />;
						})}
					</Div>
				)}

				{searchResults.songs.length > 0 && (
					<Div transparent style={styles.section}>
						<Text type='h3' style={styles.sectionTitle}>
							Songs
						</Text>
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
		paddingTop: 24,
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
