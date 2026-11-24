import { useCallback, useRef, useState } from 'react';
import type { Song } from '@/types/song';
import { fetchPlaylistTracks, movePlaylistItem, removeFromPlaylist } from '@/utils/plex';

/** Thrown when a save fails partway; carries the playlist as it now exists on the server. */
export class PlaylistSaveError extends Error {
	constructor(
		readonly cause: unknown,
		readonly freshTracks: Song[] | null,
	) {
		super('Some playlist changes could not be saved');
	}
}

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
		} catch (error) {
			// A removal or move failed partway: what landed on the server no longer matches either the
			// original or the edit. Re-sync from the server and leave edit mode so state can't drift.
			let freshTracks: Song[] | null = null;
			try {
				freshTracks = await fetchPlaylistTracks(playlistKey);
			} catch {}
			setIsEditing(false);
			setEditedTracks([]);
			originalRef.current = [];
			throw new PlaylistSaveError(error, freshTracks);
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
