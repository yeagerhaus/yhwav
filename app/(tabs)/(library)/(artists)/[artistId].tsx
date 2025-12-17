import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';
import { DynamicItem, ThemedText, ThemedView } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';

export default function ArtistDetailScreen() {
	const { artistId } = useLocalSearchParams<{ artistId: string }>();
	const artistKey = decodeURIComponent(artistId ?? '').toLowerCase();

	const artist = useLibraryStore((s) => s.artistsByName[artistKey]);
	const albumsById = useLibraryStore((s) => s.albumsById);

	if (!artist) {
		return (
			<ThemedView style={styles.container}>
				<ThemedText style={styles.header}>Artist not found</ThemedText>
			</ThemedView>
		);
	}

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
		<Main>
			<Div style={{ paddingHorizontal: 16 }}>
				<Div>
					<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16 }}>{artist.name}</ThemedText>
				</Div>
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
});
