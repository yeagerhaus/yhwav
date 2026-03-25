import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import DraggableFlatList, { type RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Div, DynamicItem, Main, Text } from '@/components';
import { DefaultSharedComponents } from '@/constants/styles';
import { useColors } from '@/hooks/useColors';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { usePlaylistEditor } from '@/hooks/usePlaylistEditor';
import { usePlaylists } from '@/hooks/usePlaylists';
import type { Playlist } from '@/types/playlist';
import type { Song } from '@/types/song';
import { deletePlaylist, updatePlaylistMetadata } from '@/utils/plex';
import { hexWithOpacity } from '@/utils/styles';

const ITEM_HEIGHT = 70;

export default function DetailScreen() {
	const colors = useColors();
	const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
	const { playlists, loadPlaylistTracks, refreshPlaylists } = usePlaylists();
	const setPlaylists = useLibraryStore((s) => s.setPlaylists);
	const isOffline = useOfflineModeStore((s) => s.offlineMode);
	const [songs, setSongs] = useState<Song[]>([]);
	const [playlist, setPlaylist] = useState<Playlist | null>(null);
	const [artwork, setArtwork] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState('');

	const ratingKey = playlist?.ratingKey ?? '';
	const editor = usePlaylistEditor(ratingKey, playlistId);

	const dlDownloads = useMusicDownloadsStore((s) => s.downloads);
	const dlDownloading = useMusicDownloadsStore((s) => s.downloading);
	const dlQueue = useMusicDownloadsStore((s) => s.queue);
	const dlQueueTotal = useMusicDownloadsStore((s) => s.queueTotal);
	const dlQueueCompleted = useMusicDownloadsStore((s) => s.queueCompleted);
	const downloadTracks = useMusicDownloadsStore((s) => s.downloadTracks);
	const removeDownloads = useMusicDownloadsStore((s) => s.removeDownloads);
	const savePlaylistForOffline = useMusicDownloadsStore((s) => s.savePlaylistForOffline);
	const removePlaylistForOffline = useMusicDownloadsStore((s) => s.removePlaylistForOffline);
	const downloadedPlaylists = useMusicDownloadsStore((s) => s.downloadedPlaylists);

	const downloadedCount = useMemo(() => songs.filter((s) => !!dlDownloads[s.id]).length, [songs, dlDownloads]);
	const isFullyDownloaded = songs.length > 0 && downloadedCount === songs.length;
	const isDlActive = useMemo(
		() => songs.some((s) => dlDownloading.has(s.id) || dlQueue.some((q) => q.id === s.id)),
		[songs, dlDownloading, dlQueue],
	);

	const handleDownloadPlaylist = useCallback(() => {
		if (isFullyDownloaded && playlist) {
			removeDownloads(songs.map((s) => s.id));
			removePlaylistForOffline(playlist.key);
		} else if (playlist) {
			downloadTracks(songs);
			savePlaylistForOffline(playlist, songs);
		}
	}, [isFullyDownloaded, songs, playlist, downloadTracks, removeDownloads, savePlaylistForOffline, removePlaylistForOffline]);

	const dlLabel = isDlActive
		? `Downloading${dlQueueTotal > 0 ? ` ${dlQueueCompleted}/${dlQueueTotal}` : '…'}`
		: isFullyDownloaded
			? 'Remove Download'
			: downloadedCount > 0
				? `Download (${songs.length - downloadedCount} remaining)`
				: 'Download';

	useEffect(() => {
		if (!playlistId) return;

		const loadPlaylistData = async () => {
			// Try library playlists first, then check offline store
			const foundPlaylist = playlists.find((p) => p.key === playlistId || p.id === playlistId);
			const offlinePlaylist = downloadedPlaylists[playlistId];

			if (foundPlaylist) {
				setPlaylist(foundPlaylist);
				if (foundPlaylist.artworkUrl) setArtwork(foundPlaylist.artworkUrl);
			} else if (offlinePlaylist) {
				setPlaylist({
					id: offlinePlaylist.id,
					key: offlinePlaylist.key,
					ratingKey: offlinePlaylist.ratingKey,
					title: offlinePlaylist.title,
					summary: offlinePlaylist.summary,
					artworkUrl: offlinePlaylist.artworkUrl,
					playlistType: offlinePlaylist.playlistType,
					leafCount: offlinePlaylist.leafCount,
				});
				if (offlinePlaylist.artworkUrl) setArtwork(offlinePlaylist.artworkUrl);
			}

			// Try fetching tracks from server; fall back to offline store
			const tracks = await loadPlaylistTracks(playlistId);
			if (tracks && tracks.length > 0) {
				const sorted = tracks.sort((a, b) => {
					const playlistIndexDiff = (a.playlistIndex ?? 0) - (b.playlistIndex ?? 0);
					if (playlistIndexDiff !== 0) return playlistIndexDiff;
					const trackDiff = (a.trackNumber ?? 0) - (b.trackNumber ?? 0);
					if (trackDiff !== 0) return trackDiff;
					return (a.discNumber ?? 0) - (b.discNumber ?? 0);
				});
				setSongs(sorted);
			} else if (offlinePlaylist) {
				setSongs(offlinePlaylist.songs);
			}
		};

		loadPlaylistData();
	}, [playlistId, playlists, loadPlaylistTracks, downloadedPlaylists]);

	const handleEdit = useCallback(() => {
		editor.startEditing(songs);
		setEditTitle(playlist?.title || '');
	}, [editor, songs, playlist]);

	const handleCancel = useCallback(() => {
		editor.cancelEditing();
	}, [editor]);

	const handleSave = useCallback(async () => {
		if (!playlist) return;

		if (editTitle && editTitle !== playlist.title) {
			await updatePlaylistMetadata(playlist.ratingKey, { title: editTitle });
		}

		const freshTracks = await editor.save();
		setSongs(freshTracks);
		await refreshPlaylists();
	}, [editor, editTitle, playlist, refreshPlaylists]);

	const handleDelete = useCallback(() => {
		if (!playlist) return;

		Alert.alert('Delete Playlist', `Are you sure you want to delete "${playlist.title}"?`, [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: async () => {
					await deletePlaylist(playlist.ratingKey);
					const updated = playlists.filter((p) => p.id !== playlist.id);
					setPlaylists(updated);
					router.back();
				},
			},
		]);
	}, [playlist, playlists, setPlaylists]);

	const styles = useMemo(
		() => ({
			...staticStyles,
			editButton: {
				paddingVertical: 6,
				paddingHorizontal: 14,
				borderRadius: 16,
				backgroundColor: hexWithOpacity(colors.brand, 0.15),
			},
			titleInput: {
				fontSize: 24,
				fontWeight: 'bold' as const,
				color: colors.text,
				borderBottomWidth: 1,
				borderBottomColor: colors.brand,
				paddingVertical: 8,
				marginBottom: 16,
			},
			editRowActive: {
				backgroundColor: hexWithOpacity(colors.brand, 0.1),
				borderRadius: DefaultSharedComponents.borderRadiusSM,
			},
			editSongArtist: {
				fontSize: 13,
				color: colors.textMuted,
			},
			downloadBtn: {
				flexDirection: 'row' as const,
				alignItems: 'center' as const,
				gap: 6,
				paddingVertical: 6,
				paddingHorizontal: 14,
				borderRadius: 16,
				backgroundColor: hexWithOpacity(colors.brand, 0.15),
			},
		}),
		[colors],
	);

	const keyExtractor = useCallback((item: Song) => item.id, []);
	const renderItem = useCallback(
		({ item }: { item: Song }) => <DynamicItem item={item} type='song' queue={songs} playlistRatingKey={ratingKey} />,
		[songs, ratingKey],
	);
	const getItemLayout = useCallback(
		(_: any, index: number) => ({
			length: ITEM_HEIGHT,
			offset: ITEM_HEIGHT * index,
			index,
		}),
		[],
	);

	const editKeyExtractor = useCallback((item: Song) => item.playlistItemId || item.id, []);
	const renderEditItem = useCallback(
		({ item, drag, isActive }: RenderItemParams<Song>) => (
			<ScaleDecorator>
				<Pressable onLongPress={drag} disabled={isActive} style={[styles.editRow, isActive && styles.editRowActive]}>
					<Pressable
						onPress={() => item.playlistItemId && editor.removeTrack(item.playlistItemId)}
						hitSlop={8}
						style={styles.removeButton}
					>
						<SymbolView name='minus.circle' size={24} tintColor={colors.dangerSolid} />
					</Pressable>
					<Div style={styles.editSongInfo} transparent>
						<Text numberOfLines={1} style={styles.editSongTitle}>
							{item.title}
						</Text>
						<Text numberOfLines={1} style={styles.editSongArtist}>
							{item.artist}
						</Text>
					</Div>
					<SymbolView name='text.justify' size={24} tintColor={colors.textMuted} />
				</Pressable>
			</ScaleDecorator>
		),
		[editor, colors.dangerSolid, colors.textMuted],
	);

	const listHeaderComponent = useMemo(
		() => (
			<Div style={{ alignItems: 'center', paddingTop: 64 }} transparent>
				{artwork && (
					<Image
						source={{ uri: artwork }}
						style={{ width: '100%', maxHeight: 250, aspectRatio: 1, borderRadius: 8 }}
						contentFit='contain'
					/>
				)}
				<Div style={{ paddingVertical: 16, width: '100%' }} transparent>
					{editor.isEditing ? (
						<Div transparent>
							<Div transparent style={styles.editHeader}>
								<Pressable onPress={handleCancel}>
									<Text type='body' colorVariant='muted'>
										Cancel
									</Text>
								</Pressable>
								<Pressable onPress={handleSave} disabled={editor.isSaving}>
									<Text type='body' colorVariant='brand' style={editor.isSaving ? { opacity: 0.5 } : undefined}>
										{editor.isSaving ? 'Saving...' : 'Save'}
									</Text>
								</Pressable>
							</Div>
							<TextInput
								value={editTitle}
								onChangeText={setEditTitle}
								style={styles.titleInput}
								placeholderTextColor={colors.textMuted}
								placeholder='Playlist title'
							/>
							<Pressable onPress={handleDelete} style={styles.deleteButton}>
								<SymbolView name='trash' size={18} tintColor={colors.dangerSolid} />
								<Text type='body' colorVariant='danger'>
									Delete Playlist
								</Text>
							</Pressable>
						</Div>
					) : (
						<Div transparent>
							<Div transparent style={styles.normalHeader}>
								<Div style={{ flex: 1 }} transparent>
									{playlist && (
										<Div style={{ marginBottom: 16 }} transparent>
											<Text type='h2'>{playlist.title}</Text>
											<Text type='body' colorVariant='muted'>
												{playlist.summary || `${playlist.leafCount || 0} tracks`}
											</Text>
										</Div>
									)}
								</Div>
								<Div transparent style={{ flexDirection: 'row', gap: 8 }}>
									{songs.length > 0 && (
										<Pressable onPress={handleDownloadPlaylist} disabled={isDlActive} style={styles.downloadBtn}>
											{isDlActive ? (
												<ActivityIndicator size='small' color={colors.brand} />
											) : (
												<SymbolView
													name={isFullyDownloaded ? 'trash' : 'arrow.down.circle'}
													size={18}
													tintColor={colors.brand}
												/>
											)}
											<Text type='bodySM' style={{ color: colors.brand }}>
												{dlLabel}
											</Text>
										</Pressable>
									)}
									{!isOffline && (
										<Pressable onPress={handleEdit} style={styles.editButton}>
											<Text type='body' colorVariant='brand' style={styles.editButtonText}>
												Edit
											</Text>
										</Pressable>
									)}
								</Div>
							</Div>
						</Div>
					)}
				</Div>
			</Div>
		),
		[
			artwork,
			playlist,
			editor.isEditing,
			editor.isSaving,
			editTitle,
			handleEdit,
			handleCancel,
			handleSave,
			handleDelete,
			songs,
			isDlActive,
			isFullyDownloaded,
			dlLabel,
			handleDownloadPlaylist,
			isOffline,
			colors,
		],
	);

	if (editor.isEditing) {
		return (
			<Main scrollEnabled={false}>
				<DraggableFlatList
					data={editor.editedTracks}
					keyExtractor={editKeyExtractor}
					renderItem={renderEditItem}
					onDragEnd={({ data }) => editor.reorderTracks(data)}
					ListHeaderComponent={listHeaderComponent}
					contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
				/>
			</Main>
		);
	}

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={songs}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				getItemLayout={getItemLayout}
				ListHeaderComponent={listHeaderComponent}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={15}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}

const staticStyles = StyleSheet.create({
	editHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 12,
	},
	normalHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
	},
	editButtonText: {
		fontSize: 15,
		fontWeight: '600',
	},
	deleteButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 8,
	},
	editRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
		gap: 12,
	},
	removeButton: {
		padding: 4,
	},
	editSongInfo: {
		flex: 1,
		gap: 2,
	},
	editSongTitle: {
		fontSize: 15,
		fontWeight: '400',
	},
});
