import { useCallback, useMemo } from 'react';
import { FlatList } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';

export default function AlbumsScreen() {
	const { albums } = useOfflineFilteredLibrary();

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

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={sorted}
				keyExtractor={keyExtractor}
				numColumns={2}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={10}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
				columnWrapperStyle={{ justifyContent: 'space-between' }}
			/>
		</Main>
	);
}
