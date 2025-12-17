import { useMemo } from 'react';
import { FlatList } from 'react-native';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';

export default function AlbumsScreen() {
	const albumsById = useLibraryStore((s) => s.albumsById);

	const albums = useMemo(
		() =>
			Object.values(albumsById)
				.map((album) => ({
					id: album.id,
					album: album.title,
					artist: album.artist,
					artwork: album.artwork,
					count: album.songIds.length,
				}))
				.sort((a, b) => a.album.localeCompare(b.album)),
		[albumsById],
	);

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16 }}>
				<Div>
					<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16 }}>Albums</ThemedText>
				</Div>
				<FlatList
					scrollEnabled={false}
					data={albums}
					keyExtractor={(item) => item.id.toString()}
					numColumns={2}
					contentContainerStyle={{ paddingBottom: 300 }}
					columnWrapperStyle={{ justifyContent: 'space-between' }}
					renderItem={({ item }) => <DynamicItem item={item} type='album' />}
				/>
			</Div>
		</Main>
	);
}
