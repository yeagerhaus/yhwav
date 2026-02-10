import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';

export default function AlbumsScreen() {
	const albumsById = useLibraryStore((s) => s.albumsById);

	const [albums, setAlbums] = useState<Array<{ id: string; album: string; artist: string; artwork: string; count: number }>>([]);

	// Defer processing for large album lists
	useEffect(() => {
		const albumValues = Object.values(albumsById);
		
		if (albumValues.length > 5000) {
			// Process in chunks for very large album lists
			const processInChunks = () => {
				const CHUNK_SIZE = 2000;
				const processed: typeof albums = [];
				let chunkIndex = 0;

				const processChunk = () => {
					const start = chunkIndex * CHUNK_SIZE;
					const end = Math.min(start + CHUNK_SIZE, albumValues.length);
					const chunk = albumValues.slice(start, end);

					const chunkProcessed = chunk.map((album) => ({
						id: album.id,
						album: album.title,
						artist: album.artist,
						artwork: album.artwork,
						count: album.songIds.length,
					}));

					processed.push(...chunkProcessed);
					chunkIndex++;

					if (end < albumValues.length) {
						setAlbums([...processed]);
						setTimeout(processChunk, 5);
					} else {
						const sorted = processed.sort((a, b) => a.album.localeCompare(b.album));
						setAlbums(sorted);
					}
				};

				setTimeout(processChunk, 0);
			};

			processInChunks();
		} else {
			// Small lists can process synchronously
			const processed = albumValues
				.map((album) => ({
					id: album.id,
					album: album.title,
					artist: album.artist,
					artwork: album.artwork,
					count: album.songIds.length,
				}))
				.sort((a, b) => a.album.localeCompare(b.album));
			setAlbums(processed);
		}
	}, [albumsById]);

	const renderItem = useCallback(({ item }: { item: typeof albums[0] }) => <DynamicItem item={item} type='album' />, []);
	const keyExtractor = useCallback((item: typeof albums[0]) => item.id.toString(), []);

	const listHeaderComponent = useMemo(
		() => (
			<Div>
				<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16, paddingTop: 64 }}>Albums</ThemedText>
			</Div>
		),
		[],
	);

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={albums}
				keyExtractor={keyExtractor}
				numColumns={2}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={10}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
				columnWrapperStyle={{ justifyContent: 'space-between' }}
			/>
		</Main>
	);
}
