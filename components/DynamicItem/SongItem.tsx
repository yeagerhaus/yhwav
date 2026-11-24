import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { MusicVisualizer } from '@/components/MusicVisualizer';
import { Text } from '@/components/Text';
import { useAddToPlaylist } from '@/hooks/useAddToPlaylist';
import { useAudioStore } from '@/hooks/useAudioStore';
import { useColors } from '@/hooks/useColors';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useSongDownloadStatus, useSongPlayingState } from '@/hooks/useSongRowState';
import type { Song } from '@/types/song';
import { ContextMenu, type ContextMenuItem } from '../ContextMenu';
import { Div } from '../Div';

// Memoized component to prevent unnecessary re-renders
const SongItem = React.memo(
	({ item, queue, listItem, playlistRatingKey }: { item: Song; queue?: Song[]; listItem?: boolean; playlistRatingKey?: string }) => {
		const colors = useColors();
		const openAddToPlaylist = useAddToPlaylist((s) => s.open);
		const artistRatingKey = item.artistKey?.split('/').pop() || item.artistKey;
		const matchedArtist = useLibraryStore((s) => (artistRatingKey ? s.artistsById[artistRatingKey] : undefined));
		const matchedAlbum = useLibraryStore((s) => (item.albumId ? s.albumsById[item.albumId] : undefined));
		const playSound = useAudioStore((state) => state.playSound);
		const playNext = useAudioStore((state) => state.playNext);
		const addToQueue = useAudioStore((state) => state.addToQueue);

		const { isCurrent: isCurrentSong, showAsPlaying } = useSongPlayingState(item.id);
		const downloadStatus = useSongDownloadStatus(item.id);
		const downloaded = downloadStatus === 'downloaded';
		const downloading = downloadStatus === 'downloading';
		const queued = downloadStatus === 'queued';
		const downloadTrack = useMusicDownloadsStore((s) => s.downloadTrack);
		const removeDownload = useMusicDownloadsStore((s) => s.removeDownload);

		const playSong = useCallback(
			async (song: Song) => {
				await playSound(song, queue, playlistRatingKey ? { playlistRatingKey } : undefined);
			},
			[playSound, queue, playlistRatingKey],
		);

		const menuItems: ContextMenuItem[] = [
			{
				label: 'Play Next',
				systemImage: 'text.line.first.and.arrowtriangle.forward',
				onPress: () => playNext(item),
			},
			{
				label: 'Add to Queue',
				systemImage: 'text.badge.plus',
				onPress: () => addToQueue([item]),
			},
			{
				label: 'Add to Playlist',
				systemImage: 'plus.circle',
				onPress: () => openAddToPlaylist(`${item.title} — ${item.artist}`, [item.id]),
			},
			{
				label: 'Go to Album',
				systemImage: 'square.stack',
				onPress: () => {
					// Push directly: a back() + delayed push corrupted the back stack on non-modal screens.
					if (matchedAlbum) router.push(`/(tabs)/(library)/(albums)/${matchedAlbum.id}`);
				},
			},
			{
				label: 'Go to Artist',
				systemImage: 'person.circle',
				onPress: () => {
					if (matchedArtist) router.push(`/(tabs)/(library)/(artists)/${matchedArtist.key}`);
				},
			},
			downloaded
				? {
						label: 'Remove Download',
						systemImage: 'trash',
						destructive: true,
						onPress: () => removeDownload(item.id),
					}
				: {
						label: 'Download',
						systemImage: 'arrow.down.circle',
						disabled: downloading || queued,
						onPress: () => downloadTrack(item),
					},
		];

		const downloadIndicator =
			downloading || queued ? (
				<ActivityIndicator size='small' color={colors.brand} style={{ marginLeft: 4 }} />
			) : downloaded ? (
				<SymbolView name='arrow.down.circle.fill' size={14} tintColor={colors.brand} style={{ marginLeft: 4 }} />
			) : null;

		if (listItem) {
			return (
				<Pressable onPress={() => playSong(item)} style={styles.songItem}>
					<Div style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }} transparent>
						{isCurrentSong && showAsPlaying ? (
							<MusicVisualizer isPlaying={showAsPlaying} />
						) : (
							<Text type='body' numberOfLines={1} style={styles.songTitle}>
								{item.playlistIndex !== undefined ? item.playlistIndex + 1 : item.trackNumber}
							</Text>
						)}
					</Div>
					<Div style={[styles.songInfoContainerList, { borderBottomColor: colors.listDivider }]} transparent>
						<Div style={styles.songInfo} transparent>
							<Text type='body' numberOfLines={1} style={styles.songTitle}>
								{item.title}
							</Text>
							<Div style={styles.artistRow} transparent>
								{isCurrentSong && <SymbolView name='music.note' size={12} tintColor={colors.brand} />}
								{downloadIndicator}
								<Text type='bodySM' numberOfLines={1} style={styles.songArtist}>
									{item.artist}
								</Text>
							</Div>
						</Div>
						<Div
							transparent
							style={{
								width: 32,
								height: 32,
								borderRadius: 20,
								backgroundColor: '',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<ContextMenu
								items={menuItems}
								style={{
									width: 32,
									height: 32,
									borderRadius: 20,
									backgroundColor: '',
									justifyContent: 'center',
									alignItems: 'center',
								}}
							>
								<SymbolView name='ellipsis' size={20} tintColor='#999' />
							</ContextMenu>
						</Div>
					</Div>
				</Pressable>
			);
		}

		return (
			<Pressable onPress={() => playSong(item)} style={styles.songItem}>
				<Div transparent style={styles.artworkContainer}>
					<Image source={{ uri: item.artworkUrl }} style={styles.songArtwork} contentFit='cover' recyclingKey={item.id} />
					{isCurrentSong && <MusicVisualizer isPlaying={showAsPlaying} />}
				</Div>
				<Div transparent style={[styles.songInfoContainer, { borderBottomColor: colors.listDivider }]}>
					<Div transparent style={styles.songInfo}>
						<Text type='body' numberOfLines={1} style={styles.songTitle}>
							{item.title}
						</Text>
						<Div transparent style={styles.artistRow}>
							{isCurrentSong && <SymbolView name='music.note' size={10} tintColor={colors.brand} />}
							{downloadIndicator}
							<Text type='bodySM' numberOfLines={1} style={styles.songArtist}>
								{item.artist}
							</Text>
						</Div>
					</Div>
					<Div
						transparent
						style={{
							width: 32,
							height: 32,
							borderRadius: 20,
							backgroundColor: '',
							justifyContent: 'center',
							alignItems: 'center',
						}}
					>
						<ContextMenu
							items={menuItems}
							style={{
								width: 32,
								height: 32,
								borderRadius: 20,
								backgroundColor: '',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<SymbolView name='ellipsis' size={20} tintColor={colors.textSecondary} />
						</ContextMenu>
					</Div>
				</Div>
			</Pressable>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.item.id === nextProps.item.id &&
			prevProps.item.title === nextProps.item.title &&
			prevProps.item.artist === nextProps.item.artist &&
			prevProps.listItem === nextProps.listItem &&
			// Compare the queue reference, not just its length: a same-length reordered/filtered queue must
			// re-render so playSong doesn't close over a stale queue.
			prevProps.queue === nextProps.queue &&
			prevProps.playlistRatingKey === nextProps.playlistRatingKey
		);
	},
);

SongItem.displayName = 'SongItem';

export default SongItem;

const styles = StyleSheet.create({
	songItem: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 12,
	},
	artworkContainer: {
		position: 'relative',
		width: 50,
		height: 50,
	},
	songArtwork: {
		width: '100%',
		height: '100%',
		borderRadius: 4,
	},
	songInfoContainerList: {
		flex: 1,
		gap: 4,
		flexDirection: 'row',
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 4,
		paddingRight: 4,
	},
	songInfoContainer: {
		flex: 1,
		gap: 4,
		flexDirection: 'row',
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 14,
		paddingRight: 14,
	},
	songInfo: {
		flex: 1,
		gap: 4,
		backgroundColor: 'transparent',
	},
	artistRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		backgroundColor: 'transparent',
	},
	songTitle: {
		fontSize: 15,
		fontWeight: '400',
	},
	songArtist: {
		fontSize: 14,
		fontWeight: '400',
		opacity: 0.6,
		marginTop: -4,
	},
	moreButton: {
		padding: 8,
	},
});
