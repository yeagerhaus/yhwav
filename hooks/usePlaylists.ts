import { useCallback, useState } from 'react';
import { fetchAllPlaylists, fetchPlaylistTracks } from '@/utils/plex';
import { useLibraryStore } from './useLibraryStore';
import { getIsOfflineMode } from './useOfflineModeStore';

export const usePlaylists = () => {
	const playlists = useLibraryStore((s) => s.playlists);
	const setPlaylists = useLibraryStore((s) => s.setPlaylists);
	const [isLoading] = useState(false);

	const refreshPlaylists = useCallback(async () => {
		if (getIsOfflineMode()) return;
		try {
			const fetched = await fetchAllPlaylists();
			setPlaylists(fetched);
		} catch (error) {
			console.error('Failed to refresh playlists:', error);
		}
	}, [setPlaylists]);

	const loadPlaylistTracks = useCallback(async (playlistId: string) => {
		if (getIsOfflineMode()) return [];
		try {
			return await fetchPlaylistTracks(playlistId);
		} catch (error) {
			console.error('Failed to load playlist tracks:', error);
			return [];
		}
	}, []);

	return {
		playlists,
		isLoading,
		loadPlaylistTracks,
		refreshPlaylists,
	};
};
