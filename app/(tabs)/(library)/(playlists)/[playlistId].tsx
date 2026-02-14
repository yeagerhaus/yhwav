import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, TextInput } from 'react-native';
import DraggableFlatList, { type RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlaylistEditor } from '@/hooks/usePlaylistEditor';
import { usePlaylists } from '@/hooks/usePlaylists';
import type { Playlist } from '@/types/playlist';
import type { Song } from '@/types/song';
import { deletePlaylist, updatePlaylistMetadata } from '@/utils/plex';

const ITEM_HEIGHT = 70;

export default function DetailScreen() {
	const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
	const { playlists, loadPlaylistTracks, refreshPlaylists } = usePlaylists();
	const setPlaylists = useLibraryStore((s) => s.setPlaylists);
	const [songs, setSongs] = useState<Song[]>([]);
	const [playlist, setPlaylist] = useState<Playlist | null>(null);
	const [artwork, setArtwork] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState('');

	const editor = usePlaylistEditor(playlistId);

	useEffect(() => {
		if (!playlistId) return;

		const loadPlaylistData = async () => {
			const foundPlaylist = playlists.find((p) => p.key === playlistId || p.id === playlistId);
			if (foundPlaylist) {
				setPlaylist(foundPlaylist);
				if (foundPlaylist.artworkUrl) {
					setArtwork(foundPlaylist.artworkUrl);
				}
			}

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
			}
		};

		loadPlaylistData();
	}, [playlistId, playlists, loadPlaylistTracks]);

	const handleEdit = useCallback(() => {
		editor.startEditing(songs);
		setEditTitle(playlist?.title || '');
	}, [editor, songs, playlist]);

	const handleCancel = useCallback(() => {
		editor.cancelEditing();
	}, [editor]);

	const handleSave = useCallback(async () => {
		if (!playlist) return;

		// Update title if changed
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

	// Normal mode list
	const keyExtractor = useCallback((item: Song) => item.id, []);
	const renderItem = useCallback(({ item }: { item: Song }) => <DynamicItem item={item} type='song' queue={songs} />, [songs]);
	const getItemLayout = useCallback(
		(_: any, index: number) => ({
			length: ITEM_HEIGHT,
			offset: ITEM_HEIGHT * index,
			index,
		}),
		[],
	);

	// Edit mode list
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
						<Ionicons name='remove-circle' size={24} color='#ff3b30' />
					</Pressable>
					<Div style={styles.editSongInfo}>
						<ThemedText numberOfLines={1} style={styles.editSongTitle}>
							{item.title}
						</ThemedText>
						<ThemedText numberOfLines={1} style={styles.editSongArtist}>
							{item.artist}
						</ThemedText>
					</Div>
					<Ionicons name='reorder-three' size={24} color='#888' />
				</Pressable>
			</ScaleDecorator>
		),
		[editor],
	);

	const listHeaderComponent = useMemo(
		() => (
			<Div style={{ alignItems: 'center', paddingTop: 64 }}>
				{artwork && (
					<Image source={{ uri: artwork }} style={{ width: '100%', maxHeight: 250, aspectRatio: 1 }} resizeMode='contain' />
				)}
				<Div style={{ paddingVertical: 16, width: '100%' }}>
					{editor.isEditing ? (
						<Div>
							<Div style={styles.editHeader}>
								<Pressable onPress={handleCancel}>
									<ThemedText style={styles.cancelButton}>Cancel</ThemedText>
								</Pressable>
								<Pressable onPress={handleSave} disabled={editor.isSaving}>
									<ThemedText style={[styles.saveButton, editor.isSaving && { opacity: 0.5 }]}>
										{editor.isSaving ? 'Saving...' : 'Save'}
									</ThemedText>
								</Pressable>
							</Div>
							<TextInput
								value={editTitle}
								onChangeText={setEditTitle}
								style={styles.titleInput}
								placeholderTextColor='#888'
								placeholder='Playlist title'
							/>
							<Pressable onPress={handleDelete} style={styles.deleteButton}>
								<Ionicons name='trash-outline' size={18} color='#ff3b30' />
								<ThemedText style={styles.deleteText}>Delete Playlist</ThemedText>
							</Pressable>
						</Div>
					) : (
						<Div>
							<Div style={styles.normalHeader}>
								<Div style={{ flex: 1 }}>
									{playlist && (
										<Div style={{ marginBottom: 16 }}>
											<ThemedText style={{ fontSize: 24, fontWeight: 'bold' }}>{playlist.title}</ThemedText>
											<ThemedText style={{ fontSize: 16, color: '#888' }}>
												{playlist.summary || `${playlist.leafCount || 0} tracks`}
											</ThemedText>
										</Div>
									)}
								</Div>
								<Pressable onPress={handleEdit} style={styles.editButton}>
									<ThemedText style={styles.editButtonText}>Edit</ThemedText>
								</Pressable>
							</Div>
						</Div>
					)}
				</Div>
			</Div>
		),
		[artwork, playlist, editor.isEditing, editor.isSaving, editTitle, handleEdit, handleCancel, handleSave, handleDelete],
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
				contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}

const styles = StyleSheet.create({
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
	cancelButton: {
		fontSize: 17,
		color: '#888',
	},
	saveButton: {
		fontSize: 17,
		fontWeight: '600',
		color: '#7f62f5',
	},
	editButton: {
		paddingVertical: 6,
		paddingHorizontal: 14,
		borderRadius: 16,
		backgroundColor: 'rgba(127, 98, 245, 0.15)',
	},
	editButtonText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#7f62f5',
	},
	titleInput: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#fff',
		borderBottomWidth: 1,
		borderBottomColor: '#7f62f5',
		paddingVertical: 8,
		marginBottom: 16,
	},
	deleteButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 8,
	},
	deleteText: {
		fontSize: 16,
		color: '#ff3b30',
	},
	editRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
		gap: 12,
	},
	editRowActive: {
		backgroundColor: 'rgba(127, 98, 245, 0.1)',
		borderRadius: 8,
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
	editSongArtist: {
		fontSize: 13,
		color: '#888',
	},
});
