import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { clearCacheAndReload } from '@/utils/cache';

// Estimated item height for getItemLayout optimization
const ITEM_HEIGHT = 70;

export default function SongsScreen() {
	// Use selector to prevent unnecessary re-renders
	const tracks = useLibraryStore((s) => s.tracks);
	const isIndexing = useLibraryStore((s) => s.isLibraryIndexing);
	const [sortedSongs, setSortedSongs] = useState<typeof tracks>([]);
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await clearCacheAndReload();
		setRefreshing(false);
	}, []);

	// Defer sorting for large lists to prevent UI freeze - use chunked sorting
	useEffect(() => {
		if (tracks.length === 0) {
			setSortedSongs([]);
			return;
		}

		// For very large lists, sort in chunks to prevent blocking
		if (tracks.length > 5000) {
			// Use chunked sorting for massive libraries
			const sortInChunks = () => {
				const CHUNK_SIZE = 2000; // Smaller chunks
				const sorted: typeof tracks = [];
				let chunkIndex = 0;

				const sortChunk = () => {
					const start = chunkIndex * CHUNK_SIZE;
					const end = Math.min(start + CHUNK_SIZE, tracks.length);
					const chunk = tracks.slice(start, end);
					const sortedChunk = chunk.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
					sorted.push(...sortedChunk);
					
					chunkIndex++;
					
					if (end < tracks.length) {
						// Update with what we have so far (no copy - use reference)
						setSortedSongs(sorted);
						// Longer delay for very large lists
						setTimeout(sortChunk, tracks.length > 20000 ? 20 : 10);
					} else {
						// Final sort of all chunks together
						// For huge lists, this might still be slow, so do it async
						setTimeout(() => {
							const finalSorted = sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
							setSortedSongs(finalSorted);
						}, 0);
					}
				};

				setTimeout(sortChunk, 0);
			};

			sortInChunks();
		} else if (tracks.length > 1000) {
			// Medium lists - sort asynchronously
			const sortTimer = setTimeout(() => {
				const sorted = [...tracks].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
				setSortedSongs(sorted);
			}, 0);
			return () => clearTimeout(sortTimer);
		} else {
			// Small lists can be sorted synchronously
			const sorted = [...tracks].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
			setSortedSongs(sorted);
		}
	}, [tracks]);

	const songs = sortedSongs;

	const renderItem = useCallback(
		({ item }: { item: typeof songs[0] }) => <DynamicItem item={item} type='song' queue={songs} />,
		[songs],
	);

	const getItemLayout = useCallback(
		(_: any, index: number) => ({
			length: ITEM_HEIGHT,
			offset: ITEM_HEIGHT * index,
			index,
		}),
		[],
	);

	const keyExtractor = useCallback((item: typeof songs[0]) => item.id.toString(), []);

	const listHeaderComponent = useMemo(
		() => (
			<Div>
				<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16 }}>Songs</ThemedText>
			</Div>
		),
		[],
	);

	// Show loading state while indexing or sorting
	if (isIndexing || (tracks.length > 0 && sortedSongs.length === 0)) {
		return (
			<Main scrollEnabled={false}>
				<Div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
					<ActivityIndicator size='large' color='#FA2D48' />
					<ThemedText style={{ marginTop: 16, fontSize: 16, opacity: 0.7 }}>
						{isIndexing ? 'Indexing library...' : 'Sorting songs...'}
					</ThemedText>
				</Div>
			</Main>
		);
	}

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={songs}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				getItemLayout={getItemLayout}
				ListHeaderComponent={listHeaderComponent}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={15}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor='#FA2D48' />}
			/>
		</Main>
	);
}
