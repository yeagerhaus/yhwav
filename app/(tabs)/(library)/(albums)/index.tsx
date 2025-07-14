import {
	FlatList,
	Text,
	View,
	StyleSheet,
} from 'react-native';
import { groupBy, map } from 'lodash';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { DynamicItem } from '@/cmps';
import { Main } from '@/cmps/Main';

export default function AlbumsScreen() {
	const tracks = useLibraryStore((s) => s.tracks);

	const albums = map(groupBy(tracks, 'album'), (songsByAlbum, album) => ({
		album,
		count: songsByAlbum.length,
		artwork: songsByAlbum[0]?.artwork,
	})).sort((a, b) =>
		a.album.localeCompare(b.album, undefined, { sensitivity: 'base' })
	);

	return (
		<Main>
			<View style={{ flex: 1, paddingTop: 32, padding: 16 }}>
				<FlatList
					data={albums}
					keyExtractor={(item) => item.album}
					numColumns={2}
					contentContainerStyle={{ paddingBottom: 80 }}
					columnWrapperStyle={{ justifyContent: 'space-between' }}
					renderItem={({ item }) => <DynamicItem item={item} type="grid" />}
				/>
			</View>
		</Main>
	);
}

