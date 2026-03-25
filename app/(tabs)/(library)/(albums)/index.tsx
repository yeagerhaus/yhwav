import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
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
			<FlashList
				data={sorted}
				keyExtractor={keyExtractor}
				numColumns={2}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}
