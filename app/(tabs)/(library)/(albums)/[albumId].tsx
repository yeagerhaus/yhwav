import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image } from 'react-native';
import ImageColors from 'react-native-image-colors';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useAlbums } from '@/hooks/useAlbums';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import type { Song } from '@/types/song';

export default function AlbumDetailScreen() {
	const { albumId } = useLocalSearchParams<{ albumId: string }>();
	const allTracks = useLibraryStore((s) => s.tracks);
	const { albumsById } = useAlbums();
	const [songs, setSongs] = useState<Song[]>([]);
	const [_bgColor, setBgColor] = useState<string>('#FA2D48');

	const album = albumsById[albumId ?? ''];
	const artwork = album?.thumb || album?.artwork || null;
	const artistName = album?.artist || null;
	const albumTitle = album?.title || decodeURIComponent(albumId || '');

	useEffect(() => {
		if (!albumId || !allTracks.length) return;

		// Filter tracks by album ratingKey if we have album metadata, else fallback to name match
		let filtered: Song[];
		if (album) {
			// Try matching by parentKey (some tracks store "/library/metadata/<ratingKey>")
			filtered = allTracks.filter((song) => song.album === album.title && song.artist === album.artist);
		} else {
			const decoded = decodeURIComponent(albumId);
			filtered = allTracks.filter((song) => song.album === decoded);
		}

		const sorted = filtered.sort((a, b) => {
			const discDiff = (a.discNumber ?? 0) - (b.discNumber ?? 0);
			if (discDiff !== 0) return discDiff;
			return (a.trackNumber ?? 0) - (b.trackNumber ?? 0);
		});

		setSongs(sorted);
	}, [albumId, allTracks, album]);

	useEffect(() => {
		if (artwork) {
			ImageColors.getColors(artwork, {
				fallback: '#FA2D48',
				cache: true,
				key: albumId || 'album',
			}).then((result) => {
				if (result.platform === 'ios') setBgColor(result.background || '#FA2D48');
				else if (result.platform === 'android') setBgColor(result.dominant || '#FA2D48');
			});
		}
	}, [artwork, albumId]);

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16 }}>
				{artwork && (
					<Image source={{ uri: artwork }} style={{ width: '100%', height: '100%', maxHeight: 250 }} resizeMode='contain' />
				)}
				<Div style={{ paddingVertical: 16 }}>
					<Div style={{ marginBottom: 16 }}>
						<ThemedText style={{ fontSize: 24, fontWeight: 'bold' }}>{albumTitle}</ThemedText>
						{artistName && <ThemedText style={{ fontSize: 16, color: '#888' }}>{artistName}</ThemedText>}
						{album?.year && <ThemedText style={{ fontSize: 14, color: '#666' }}>{album.year}</ThemedText>}
					</Div>
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
