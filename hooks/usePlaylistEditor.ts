import { useCallback, useRef, useState } from 'react';
import type { Song } from '@/types/song';
import { fetchPlaylistTracks, movePlaylistItem, removeFromPlaylist } from '@/utils/plex';

export function usePlaylistEditor(playlistId: string) {
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
					await removeFromPlaylist(playlistId, track.playlistItemId);
				}
			}

			// 2. Reorders: compare order of remaining items
			const originalRemaining = original.filter((t) => t.playlistItemId && editedItemIds.has(t.playlistItemId));
			const originalOrder = originalRemaining.map((t) => t.playlistItemId);
			const editedOrder = edited.filter((t) => t.playlistItemId).map((t) => t.playlistItemId);

			const orderChanged = originalOrder.length !== editedOrder.length || originalOrder.some((id, i) => id !== editedOrder[i]);

			if (orderChanged) {
				// Walk desired order top-to-bottom issuing MOVE calls
				for (let i = 0; i < editedOrder.length; i++) {
					const itemId = editedOrder[i];
					if (!itemId) continue;

					if (i === 0) {
						// Move to beginning (no "after" parameter)
						await movePlaylistItem(playlistId, itemId);
					} else {
						// Move after the previous item
						const afterId = editedOrder[i - 1];
						if (afterId) {
							await movePlaylistItem(playlistId, itemId, afterId);
						}
					}
				}
			}

			// 3. Refresh: fetch fresh tracks from server
			const freshTracks = await fetchPlaylistTracks(playlistId);

			setIsEditing(false);
			setEditedTracks([]);
			originalRef.current = [];

			return freshTracks;
		} finally {
			setIsSaving(false);
		}
	}, [playlistId, editedTracks]);

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
