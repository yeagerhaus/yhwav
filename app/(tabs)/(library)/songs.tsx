import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { SkeletonList, SkeletonSongRow } from '@/components/Skeletons';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';
import { clearCacheAndReload } from '@/utils/cache';

export default function SongsScreen() {
	const { tracks } = useOfflineFilteredLibrary();
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
		({ item }: { item: (typeof songs)[0] }) => <DynamicItem item={item} type='song' queue={songs} />,
		[songs],
	);

	const keyExtractor = useCallback((item: (typeof songs)[0]) => item.id.toString(), []);

	const listHeaderComponent = useMemo(
		() => (
			<Div transparent style={{ paddingTop: 64, marginBottom: 16 }}>
				<Text type='h1'>Songs</Text>
			</Div>
		),
		[],
	);

	const listEmptyComponent = useMemo(
		() => (
			<Div transparent style={{ paddingTop: 8 }}>
				<SkeletonList count={12}>
					<SkeletonSongRow />
				</SkeletonList>
			</Div>
		),
		[],
	);

	return (
		<Main scrollEnabled={false}>
			<FlashList
				data={songs}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				ListEmptyComponent={listEmptyComponent}
				contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor='#FA2D48' />}
			/>
		</Main>
	);
}
