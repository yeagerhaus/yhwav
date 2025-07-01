import {
	FlatList,
	Text,
	View,
	StyleSheet,
} from 'react-native';
import { groupBy, map } from 'lodash';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { DynamicItem } from '@/cmps';

export default function AlbumsScreen() {
	const tracks = useLibraryStore((s) => s.tracks);
	const albums = map(groupBy(tracks, 'album'), (songsByAlbum, album) => ({
		album,
		count: songsByAlbum.length,
		artwork: songsByAlbum[0]?.artwork,
	}));

	return (
		<View style={{ flex: 1, padding: 16}}>
			<FlatList
				data={albums}
				keyExtractor={(item) => item.album}
				numColumns={2}
				contentContainerStyle={{ paddingBottom: 80 }}
				columnWrapperStyle={{ justifyContent: 'space-between' }}
				renderItem={({ item }) => <DynamicItem item={item} type="grid" />}
			/>
		</View>
	);
}
