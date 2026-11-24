import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { SkeletonList, SkeletonSongRow } from '@/components/Skeletons';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';
import { clearCacheAndReload } from '@/utils/cache';

export default function SongsScreen() {
	const { tracks } = useOfflineFilteredLibrary();
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await clearCacheAndReload();
		setRefreshing(false);
	}, []);

	// Plex already returns tracks sorted by titleSort (handles leading articles); offline filtering keeps
	// that order, so no client-side sort is needed.
	const songs = tracks;

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
