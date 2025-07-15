import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { ThemedText, DynamicItem, ThemedView } from '@/cmps';

export default function ArtistDetailScreen() {
	const { artistId } = useLocalSearchParams<{ artistId: string }>();
	const artistKey = decodeURIComponent(artistId ?? '');

	const artist = useLibraryStore((s) => s.artistsByName[artistKey]);
	const albumsById = useLibraryStore((s) => s.albumsById);

	if (!artist) {
		return (
			<ThemedView style={styles.container}>
				<ThemedText style={styles.header}>Artist not found</ThemedText>
			</ThemedView>
		);
	}

	console.log('Artist Detail', artist);


	const albums = artist.albumIds
		.map((id) => albumsById[id])
		.filter(Boolean)
		.sort((a, b) => a.title.localeCompare(b.title))
		.map((album) => ({
			id: album.id,
			album: album.title,
			artwork: album.artwork,
			count: album.songIds.length,
		}));

	return (
		<ThemedView style={styles.container}>
			<ThemedText style={styles.header}>{artist.name}</ThemedText>

			<FlatList
				data={albums}
				keyExtractor={(item) => item.id}
				numColumns={2}
				contentContainerStyle={{ paddingBottom: 80 }}
				columnWrapperStyle={{ justifyContent: 'space-between' }}
				renderItem={({ item }) => <DynamicItem item={item} type="grid" />}
			/>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16, marginTop: 100 },
	header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
});
