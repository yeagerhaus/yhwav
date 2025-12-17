import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image } from 'react-native';
import ImageColors from 'react-native-image-colors';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import type { Song } from '@/types/song';

export default function AlbumDetailScreen() {
	const { albumId } = useLocalSearchParams<{ albumId: string }>();
	const allTracks = useLibraryStore((s) => s.tracks);
	const [songs, setSongs] = useState<Song[]>([]);
	const [artist, setArtist] = useState<string | null>(null);
	const [artwork, setArtwork] = useState<string | null>(null);
	const [bgColor, setBgColor] = useState<string>('#FA2D48');

	useEffect(() => {
		if (!albumId || !allTracks.length) return;

		const decoded = decodeURIComponent(albumId);
		const filtered = allTracks.filter((song) => song.album === decoded);

		const sorted = filtered.sort((a, b) => {
			const discDiff = (a.discNumber ?? 0) - (b.discNumber ?? 0);
			if (discDiff !== 0) return discDiff;
			return (a.trackNumber ?? 0) - (b.trackNumber ?? 0);
		});

		setSongs(sorted);

		if (sorted[0]?.artworkUrl) {
			setArtist(sorted[0].artist);
			setArtwork(sorted[0].artworkUrl);
			ImageColors.getColors(sorted[0].artworkUrl, {
				fallback: '#FA2D48',
				cache: true,
				key: sorted[0].id,
			}).then((result) => {
				if (result.platform === 'ios') setBgColor(result.background || '#FA2D48');
				else if (result.platform === 'android') setBgColor(result.dominant || '#FA2D48');
			});
		}
	}, [albumId, allTracks]);

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16 }}>
				{artwork && (
					<Image source={{ uri: artwork }} style={{ width: '100%', height: '100%', maxHeight: 250 }} resizeMode='contain' />
				)}
				<Div style={{ paddingVertical: 16 }}>
					{artist && (
						<Div style={{ marginBottom: 16 }}>
							<ThemedText style={{ fontSize: 24, fontWeight: 'bold' }}>{decodeURIComponent(albumId || '')}</ThemedText>
							<ThemedText style={{ fontSize: 16, color: '#888' }}>{artist}</ThemedText>
						</Div>
					)}
					<FlatList
						scrollEnabled={false}
						data={songs}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => <DynamicItem item={item} type='song' queue={songs} listItem />}
						contentContainerStyle={{ paddingBottom: 300 }}
					/>
				</Div>
			</Div>
		</Main>
	);
}
