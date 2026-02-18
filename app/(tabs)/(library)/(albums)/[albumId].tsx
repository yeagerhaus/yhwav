import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet } from 'react-native';
import ImageColors from 'react-native-image-colors';
import { Div, DynamicItem, Main, Text } from '@/components';
import { Colors } from '@/constants/styles';
import { useAlbums } from '@/hooks/useAlbums';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';
import type { Song } from '@/types/song';

export default function AlbumDetailScreen() {
	const { albumId } = useLocalSearchParams<{ albumId: string }>();
	const { tracks: allTracks } = useOfflineFilteredLibrary();
	const { albumsById } = useAlbums();
	const [songs, setSongs] = useState<Song[]>([]);
	const [_bgColor, setBgColor] = useState<string>('#FA2D48');

	const downloads = useMusicDownloadsStore((s) => s.downloads);
	const downloading = useMusicDownloadsStore((s) => s.downloading);
	const queue = useMusicDownloadsStore((s) => s.queue);
	const queueTotal = useMusicDownloadsStore((s) => s.queueTotal);
	const queueCompleted = useMusicDownloadsStore((s) => s.queueCompleted);
	const downloadTracks = useMusicDownloadsStore((s) => s.downloadTracks);
	const removeDownloads = useMusicDownloadsStore((s) => s.removeDownloads);

	const album = albumsById[albumId ?? ''];
	const artwork = album?.thumb || album?.artwork || null;
	const artistName = album?.artist || null;
	const albumTitle = album?.title || decodeURIComponent(albumId || '');

	useEffect(() => {
		if (!albumId || !allTracks.length) return;

		let filtered: Song[];
		if (album) {
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

	const downloadedCount = useMemo(
		() => songs.filter((s) => !!downloads[s.id]).length,
		[songs, downloads],
	);
	const isFullyDownloaded = songs.length > 0 && downloadedCount === songs.length;
	const isActive = useMemo(
		() => songs.some((s) => downloading.has(s.id) || queue.some((q) => q.id === s.id)),
		[songs, downloading, queue],
	);

	const handleDownload = useCallback(() => {
		if (isFullyDownloaded) {
			removeDownloads(songs.map((s) => s.id));
		} else {
			downloadTracks(songs);
		}
	}, [isFullyDownloaded, songs, downloadTracks, removeDownloads]);

	const downloadLabel = isActive
		? `Downloading${queueTotal > 0 ? ` ${queueCompleted}/${queueTotal}` : '…'}`
		: isFullyDownloaded
			? 'Remove Download'
			: downloadedCount > 0
				? `Download (${songs.length - downloadedCount} remaining)`
				: 'Download';

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16 }} transparent>
				{artwork && (
					<Div transparent style={{ width: '100%', alignItems: 'center' }}>
						<Image
							source={{ uri: artwork }}
							style={{ width: '100%', maxHeight: 250, aspectRatio: 1, borderRadius: 8 }}
							resizeMode='contain'
						/>
					</Div>
				)}
				<Div style={{ paddingVertical: 16 }} transparent>
					<Div style={{ marginBottom: 16 }} transparent>
						<Text type='h2'>{albumTitle}</Text>
						{artistName && (
							<Text type='body' colorVariant='muted'>
								{artistName}
							</Text>
						)}
						{album?.year && (
							<Text type='bodySM' colorVariant='secondary'>
								{album.year}
							</Text>
						)}
					</Div>
					{songs.length > 0 && (
						<Pressable onPress={handleDownload} disabled={isActive} style={styles.downloadButton}>
							{isActive ? (
								<ActivityIndicator size='small' color={Colors.brandPrimary} />
							) : (
								<SymbolView
									name={isFullyDownloaded ? 'trash' : 'arrow.down.circle'}
									size={20}
									tintColor={Colors.brandPrimary}
								/>
							)}
							<Text type='bodySM' style={{ color: Colors.brandPrimary }}>
								{downloadLabel}
							</Text>
						</Pressable>
					)}
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

const styles = StyleSheet.create({
	downloadButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginBottom: 16,
		paddingVertical: 8,
	},
});
