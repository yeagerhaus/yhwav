import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, FlatList, View } from 'react-native';
import ImageColors from 'react-native-image-colors';
import { ThemedText, DynamicItem, ThemedView } from '@/cmps';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { Song } from '@/types/song';
import ParallaxScrollView from '@/cmps/ParallaxScrollView';

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
		<ThemedView style={{ flex: 1}}>
		<ParallaxScrollView
			album
			headerBackgroundColor={{ light: bgColor, dark: bgColor }}
			// @ts-ignore
			headerImage={
			artwork ? (
				<Image
				source={{ uri: artwork }}
				style={{ width: '100%', height: '100%' }}
				resizeMode="cover"
				/>
			) : undefined
			}
		>
			<ThemedText style={{ fontSize: 24, fontWeight: 'bold', marginTop: 16, marginLeft: 16 }}>
				{decodeURIComponent(albumId || '')}
			</ThemedText>
			<ThemedText style={{ fontSize: 16, marginLeft: 16, marginTop: -8, color: '#888' }}>
				{artist}
			</ThemedText>

			<View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
			<FlatList
				data={songs}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => <DynamicItem item={item} type="song" queue={songs} />}
				contentContainerStyle={{ paddingBottom: 100 }}
			/>
			</View>
		</ParallaxScrollView>
		</ThemedView>
	);
}
