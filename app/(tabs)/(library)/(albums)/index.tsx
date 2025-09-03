import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { DynamicItem } from '@/cmps';
import { Main } from '@/cmps/Main';
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
			<View style={{ flex: 1, paddingTop: 32, padding: 16 }}>
				<FlatList
					data={albums}
					keyExtractor={(item) => item.id.toString()}
					numColumns={2}
					contentContainerStyle={{ paddingBottom: 80 }}
					columnWrapperStyle={{ justifyContent: 'space-between' }}
					renderItem={({ item }) => <DynamicItem item={item} type='grid' />}
				/>
			</View>
		</Main>
	);
}
