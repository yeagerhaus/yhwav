import { useCallback, useRef, useState } from 'react';
import type { Song } from '@/types/song';
import { fetchPlaylistTracks, movePlaylistItem, removeFromPlaylist } from '@/utils/plex';

/**
 * @param ratingKey - Numeric playlist ID used for CRUD API calls (e.g. "12345")
 * @param playlistKey - Full key path used for fetching tracks (e.g. "/playlists/12345/items")
 */
export function usePlaylistEditor(ratingKey: string, playlistKey: string) {
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [editedTracks, setEditedTracks] = useState<Song[]>([]);
	const originalRef = useRef<Song[]>([]);

	const startEditing = useCallback((currentTracks: Song[]) => {
		originalRef.current = [...currentTracks];
		setEditedTracks([...currentTracks]);
		setIsEditing(true);
	}, []);

	const cancelEditing = useCallback(() => {
		setEditedTracks([]);
		originalRef.current = [];
		setIsEditing(false);
	}, []);

	const removeTrack = useCallback((playlistItemId: string) => {
		setEditedTracks((prev) => prev.filter((t) => t.playlistItemId !== playlistItemId));
	}, []);

	const reorderTracks = useCallback((data: Song[]) => {
		setEditedTracks(data);
	}, []);

	const save = useCallback(async (): Promise<Song[]> => {
		setIsSaving(true);
		try {
			const original = originalRef.current;
			const edited = editedTracks;

			// 1. Removals: items in original but not in edited
			const editedItemIds = new Set(edited.map((t) => t.playlistItemId));
			const removals = original.filter((t) => t.playlistItemId && !editedItemIds.has(t.playlistItemId));

			for (const track of removals) {
				if (track.playlistItemId) {
					await removeFromPlaylist(ratingKey, track.playlistItemId);
				}
			}

			// 2. Reorders: compare order of remaining items
			const originalRemaining = original.filter((t) => t.playlistItemId && editedItemIds.has(t.playlistItemId));
			const originalOrder = originalRemaining.map((t) => t.playlistItemId);
			const editedOrder = edited.filter((t) => t.playlistItemId).map((t) => t.playlistItemId);

			const orderChanged = originalOrder.length !== editedOrder.length || originalOrder.some((id, i) => id !== editedOrder[i]);

			if (orderChanged) {
				for (let i = 0; i < editedOrder.length; i++) {
					const itemId = editedOrder[i];
					if (!itemId) continue;

					if (i === 0) {
						await movePlaylistItem(ratingKey, itemId);
					} else {
						const afterId = editedOrder[i - 1];
						if (afterId) {
							await movePlaylistItem(ratingKey, itemId, afterId);
						}
					}
				}
			}

			// 3. Refresh using the key path (which fetchPlaylistTracks expects)
			const freshTracks = await fetchPlaylistTracks(playlistKey);

			setIsEditing(false);
			setEditedTracks([]);
			originalRef.current = [];

			return freshTracks;
		} finally {
			setIsSaving(false);
		}
	}, [ratingKey, playlistKey, editedTracks]);

	return {
		isEditing,
		isSaving,
		editedTracks,
		startEditing,
		cancelEditing,
		removeTrack,
		reorderTracks,
		save,
	};
}
