import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { normalizeArtist } from '@/utils';

type ArtistRow = {
	name: string;
	count: number;
};

export default function ArtistsScreen() {
	const router = useRouter();
	const tracks = useLibraryStore((s) => s.tracks);
	const [artists, setArtists] = useState<ArtistRow[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (tracks.length === 0) {
			setArtists([]);
			setLoading(false);
			return;
		}

		// For large libraries, process in chunks to prevent UI freeze
		if (tracks.length > 10000) {
			setLoading(true);
			
			const processInChunks = () => {
				const CHUNK_SIZE = 2000;
				const grouped: Record<string, typeof tracks> = {};
				let chunkIndex = 0;

				const processChunk = () => {
					const start = chunkIndex * CHUNK_SIZE;
					const end = Math.min(start + CHUNK_SIZE, tracks.length);
					const chunk = tracks.slice(start, end);

					chunk.forEach((track) => {
						const artistName = normalizeArtist(track.artist);
						if (!grouped[artistName]) {
							grouped[artistName] = [];
						}
						grouped[artistName].push(track);
					});

					chunkIndex++;
					
					if (end < tracks.length) {
						// Process next chunk
						setTimeout(processChunk, 5);
					} else {
						// All chunks processed, create final result
						const artistRows = Object.entries(grouped).map(([artist, songs]) => ({
							name: artist,
							count: songs.length,
						}));

						const sorted = artistRows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
						setArtists(sorted);
						setLoading(false);
					}
				};

				setTimeout(processChunk, 0);
			};

			processInChunks();
		} else {
			// Small libraries can process synchronously
			const grouped = tracks.reduce((acc, track) => {
				const artistName = normalizeArtist(track.artist);
				if (!acc[artistName]) {
					acc[artistName] = [];
				}
				acc[artistName].push(track);
				return acc;
			}, {} as Record<string, typeof tracks>);

			const artistRows = Object.entries(grouped).map(([artist, songs]) => ({
				name: artist,
				count: songs.length,
			}));

			const sorted = artistRows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
			setArtists(sorted);
			setLoading(false);
		}
	}, [tracks]);

	const keyExtractor = useCallback((item: ArtistRow) => item.name, []);

	const renderItem = useCallback(
		({ item }: { item: ArtistRow }) => (
			<Pressable
				style={styles.item}
				// @ts-ignore
				onPress={() => router.push(`(library)/(artists)/${encodeURIComponent(item.name)}`)}
			>
				<View style={{ flex: 1 }}>
					<ThemedText style={styles.name}>{item.name}</ThemedText>
					<ThemedText style={styles.count}>{item.count} songs</ThemedText>
				</View>
			</Pressable>
		),
		[router],
	);

	const listHeaderComponent = useMemo(
		() => (
			<Div>
				<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16, paddingTop: 64 }}>Artists</ThemedText>
			</Div>
		),
		[],
	);

	const listEmptyComponent = useMemo(
		() => (
			<Div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
				<ActivityIndicator size='large' color='#FA2D48' />
			</Div>
		),
		[],
	);

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={artists}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				ListEmptyComponent={loading ? listEmptyComponent : undefined}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={15}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16 },
	item: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
	image: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ddd' },
	name: { fontSize: 18, fontWeight: '500' },
	count: { fontSize: 14, color: '#666' },
});
