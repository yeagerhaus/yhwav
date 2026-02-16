import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image } from 'react-native';
import ImageColors from 'react-native-image-colors';	
import { Div, DynamicItem, Main, Text } from '@/components';
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
			<Div style={{ paddingHorizontal: 16 }} transparent>
				{artwork && (
					<Div transparent style={{ width: '100%', alignItems: 'center' }}>
						<Image source={{ uri: artwork }} style={{ width: '100%', maxHeight: 250, aspectRatio: 1, borderRadius: 8 }} resizeMode='contain' />
					</Div>
				)}
				<Div style={{ paddingVertical: 16 }} transparent>
					<Div style={{ marginBottom: 16 }} transparent>
						<Text type='h2'>{albumTitle}</Text>
						{artistName && <Text type='body' style={{ color: '#888' }}>{artistName}</Text>}
						{album?.year && <Text type='bodySM' style={{ color: '#666' }}>{album.year}</Text>}
					</Div>
					<FlatList
						scrollEnabled={false}
						data={songs}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => <DynamicItem item={item} type='song' queue={songs} listItem />}
						contentContainerStyle={{ paddingBottom: 100 }}
					/>
				</Div>
			</Div>
		</Main>
	);
}
