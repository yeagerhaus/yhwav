import { useCallback, useMemo } from 'react';
import { FlatList } from 'react-native';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useAlbums } from '@/hooks/useAlbums';

export default function AlbumsScreen() {
	const { albums } = useAlbums();

	const sorted = useMemo(
		() =>
			albums.map((album) => ({
				id: album.id,
				album: album.title,
				artist: album.artist,
				artwork: album.thumb || album.artwork,
			})).sort((a, b) => a.album.localeCompare(b.album)),
		[albums],
	);

	const renderItem = useCallback(({ item }: { item: (typeof sorted)[0] }) => <DynamicItem item={item} type='album' />, []);
	const keyExtractor = useCallback((item: (typeof sorted)[0]) => item.id.toString(), []);

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
				contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
				columnWrapperStyle={{ justifyContent: 'space-between' }}
			/>
		</Main>
	);
}
