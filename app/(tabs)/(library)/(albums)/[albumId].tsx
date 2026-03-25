import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import ImageColors from 'react-native-image-colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Div, DynamicItem, Text } from '@/components';
import { SkeletonList, SkeletonTrackRow } from '@/components/Skeletons';
import { useAlbums } from '@/hooks/useAlbums';
import { useColors } from '@/hooks/useColors';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { Song } from '@/types/song';

export default function AlbumDetailScreen() {
	const colors = useColors();
	const backgroundColor = useThemeColor({}, 'background');
	const insets = useSafeAreaInsets();
	const { albumId } = useLocalSearchParams<{ albumId: string }>();
	const { tracks: allTracks, albums: offlineAlbums } = useOfflineFilteredLibrary();
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

	const album = albumsById[albumId ?? ''] || offlineAlbums.find((a) => a.id === albumId);
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

	const downloadedCount = useMemo(() => songs.filter((s) => !!downloads[s.id]).length, [songs, downloads]);
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

	const renderItem = useCallback(({ item }: { item: Song }) => <DynamicItem item={item} type='song' queue={songs} listItem />, [songs]);

	const keyExtractor = useCallback((item: Song) => item.id, []);

	const listHeaderComponent = useMemo(
		() => (
			<Div style={{ paddingHorizontal: 16 }} transparent>
				{artwork && (
					<Div transparent style={{ width: '100%', alignItems: 'center' }}>
						<Image
							source={{ uri: artwork }}
							style={{ width: '100%', maxHeight: 250, aspectRatio: 1, borderRadius: 8 }}
							contentFit='contain'
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
								<ActivityIndicator size='small' color={colors.brand} />
							) : (
								<SymbolView name={isFullyDownloaded ? 'trash' : 'arrow.down.circle'} size={20} tintColor={colors.brand} />
							)}
							<Text type='bodySM' style={{ color: colors.brand }}>
								{downloadLabel}
							</Text>
						</Pressable>
					)}
				</Div>
			</Div>
		),
		[
			artwork,
			albumTitle,
			artistName,
			album?.year,
			songs.length,
			handleDownload,
			isActive,
			isFullyDownloaded,
			downloadLabel,
			colors.brand,
		],
	);

	const listEmptyComponent = useMemo(
		() =>
			album ? (
				<Div transparent style={{ paddingTop: 8 }}>
					<SkeletonList count={8}>
						<SkeletonTrackRow />
					</SkeletonList>
				</Div>
			) : null,
		[album],
	);

	return (
		<View style={{ flex: 1, backgroundColor, paddingTop: insets.top, paddingBottom: insets.bottom }}>
			<FlashList
				data={songs}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				ListEmptyComponent={listEmptyComponent}
				contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
			/>
		</View>
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
