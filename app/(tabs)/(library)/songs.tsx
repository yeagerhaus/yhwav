import { useMemo } from 'react';
import { FlatList } from 'react-native';
import { DynamicItem, ThemedText } from '@/cmps';
import { Div } from '@/cmps/Div';
import { Main } from '@/cmps/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';

export default function SongsScreen() {
	const tracks = useLibraryStore((s) => s.tracks);

	const songs = useMemo(() => {
		return [...tracks].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
	}, [tracks]);

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16 }}>
				<Div>
					<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16 }}>Songs</ThemedText>
				</Div>
				<FlatList
					scrollEnabled={false}
					data={songs}
					keyExtractor={(item) => item.id.toString()}
					renderItem={({ item }) => <DynamicItem item={item} type='song' queue={songs} />}
					contentContainerStyle={{ paddingBottom: 300 }}
				/>
			</Div>
		</Main>
	);
}
