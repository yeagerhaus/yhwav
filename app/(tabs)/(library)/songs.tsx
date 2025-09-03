import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { DynamicItem } from '@/cmps';
import { Main } from '@/cmps/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';

export default function SongsScreen() {
	const tracks = useLibraryStore((s) => s.tracks);

	const songs = useMemo(() => {
		return [...tracks].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
	}, [tracks]);

	return (
		<Main>
			<View style={{ flex: 1, paddingTop: 32, padding: 16 }}>
				<FlatList
					data={songs}
					keyExtractor={(item) => item.id.toString()}
					renderItem={({ item }) => <DynamicItem item={item} type='song' queue={songs} />}
					contentContainerStyle={{ paddingBottom: 100 }}
				/>
			</View>
		</Main>
	);
}
