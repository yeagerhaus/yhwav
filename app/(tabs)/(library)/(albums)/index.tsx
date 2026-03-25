import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { SkeletonGridItem, SkeletonList } from '@/components/Skeletons';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';

export default function AlbumsScreen() {
	const { albums } = useOfflineFilteredLibrary();
	const hasInitialized = useLibraryStore((s) => s.hasInitialized);

	const sorted = useMemo(
		() =>
			albums
				.map((album) => ({
					id: album.id,
					album: album.title,
					artist: album.artist,
					artwork: album.thumb || album.artwork,
				}))
				.sort((a, b) => a.album.localeCompare(b.album)),
		[albums],
	);

	const renderItem = useCallback(({ item }: { item: (typeof sorted)[0] }) => <DynamicItem item={item} type='album' />, []);
	const keyExtractor = useCallback((item: (typeof sorted)[0]) => item.id.toString(), []);

	const listHeaderComponent = useMemo(
		() => (
			<Div transparent style={{ paddingTop: 64, marginBottom: 16 }}>
				<Text type='h1'>Albums</Text>
			</Div>
		),
		[],
	);

	const listEmptyComponent = useMemo(
		() =>
			hasInitialized ? (
				<Div transparent style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
					<Text type='body' colorVariant='muted'>
						No albums found
					</Text>
				</Div>
			) : (
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
					<SkeletonList count={6}>
						<SkeletonGridItem />
					</SkeletonList>
				</View>
			),
		[hasInitialized],
	);

	return (
		<Main scrollEnabled={false}>
			<FlashList
				data={sorted}
				keyExtractor={keyExtractor}
				numColumns={2}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				ListEmptyComponent={listEmptyComponent}
				contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}
