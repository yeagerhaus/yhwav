import { useEffect, useState } from 'react';
import { FlatList, View,} from 'react-native';
import { loadTracksFromDirectory } from '@/utils';
import { Song } from '@/types/song';
import { useAudio } from '@/ctx/AudioContext';
import { DynamicItem } from '@/cmps';

export default function SongsScreen() {
	const [songs, setSongs] = useState<Song[]>([]);
	const { playSound } = useAudio();

	useEffect(() => {
		(async () => {
		const data = await loadTracksFromDirectory();
		if (data) setSongs(data);
		})();
	}, []);

	return (
		<View style={{ flex: 1, paddingTop: 32 }}>
		<FlatList
			data={songs}
			keyExtractor={(item) => item.id.toString()}
			renderItem={({ item }) => <DynamicItem item={item} type="song" />}
			contentContainerStyle={{ paddingBottom: 100 }}
		/>
		</View>
	);
}
