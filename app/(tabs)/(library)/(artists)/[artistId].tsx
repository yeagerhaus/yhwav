import { useLocalSearchParams } from 'expo-router';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { DynamicItem, ThemedText, ThemedView } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useAlbums } from '@/hooks/useAlbums';
import { useArtists } from '@/hooks/useArtists';

export default function ArtistDetailScreen() {
	const { artistId } = useLocalSearchParams<{ artistId: string }>();
	const { artistsById } = useArtists();
	const { getAlbumsByArtist } = useAlbums();

	const artist = artistsById[artistId ?? ''];

	if (!artist) {
		return (
			<ThemedView style={styles.container}>
				<ThemedText style={styles.header}>Artist not found</ThemedText>
			</ThemedView>
		);
	}

	const albums = getAlbumsByArtist(artist.key)
		.sort((a, b) => a.title.localeCompare(b.title))
		.map((album) => ({
			id: album.id,
			album: album.title,
			artwork: album.thumb || album.artwork,
			artist: album.artist,
		}));

	return (
		<Main>
			<Div style={{ paddingTop: 64,paddingHorizontal: 16 }}>
				{artist.art && (
					<Image source={{ uri: artist.art }} style={styles.banner} resizeMode='cover' />
				)}
				<Div>
					<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 4 }}>{artist.name}</ThemedText>
					{artist.genres.length > 0 && (
						<ThemedText style={styles.genres}>{artist.genres.join(', ')}</ThemedText>
					)}
					{artist.country && (
						<ThemedText style={styles.country}>{artist.country}</ThemedText>
					)}
				</Div>
				{artist.summary ? (
					<View style={styles.bioContainer}>
						<ThemedText style={styles.bio} numberOfLines={4}>{artist.summary}</ThemedText>
					</View>
				) : null}
				<FlatList
					scrollEnabled={false}
					data={albums}
					keyExtractor={(item) => item.id}
					numColumns={2}
					contentContainerStyle={{ paddingBottom: 80 }}
					columnWrapperStyle={{ justifyContent: 'space-between' }}
					renderItem={({ item }) => <DynamicItem item={item} type='album' />}
				/>
			</Div>
		</Main>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16, marginTop: 100 },
	header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
	banner: { width: '100%', height: 200, borderRadius: 8, marginBottom: 16 },
	genres: { fontSize: 14, color: '#888', marginBottom: 4 },
	country: { fontSize: 14, color: '#888', marginBottom: 16 },
	bioContainer: { marginBottom: 16 },
	bio: { fontSize: 14, color: '#aaa', lineHeight: 20 },
});
