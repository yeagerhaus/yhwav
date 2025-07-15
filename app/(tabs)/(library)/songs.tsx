import { useEffect, useMemo, useState } from 'react';
import { FlatList, View,} from 'react-native';
import { Song } from '@/types/song';
import { DynamicItem } from '@/cmps';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { Main } from '@/cmps/Main';

export default function SongsScreen() {
	const tracks = useLibraryStore((s) => s.tracks);
	console.log('🎵 Tracks in Zustand:', tracks.length);

	const songs = useMemo(() => {
		return [...tracks].sort((a, b) =>
			a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
		);
	}, [tracks]);

	return (
		<Main>
			<View style={{ flex: 1, paddingTop: 32, padding: 16 }}>
				<FlatList
					data={songs}
					keyExtractor={(item) => item.id.toString()}
					renderItem={({ item }) => <DynamicItem item={item} type="song" />}
					contentContainerStyle={{ paddingBottom: 100 }}
				/>
			</View>
		</Main>
	);
}
