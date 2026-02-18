import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllPlaylists, fetchPlaylistTracks } from '@/utils/plex';
import { useLibraryStore } from './useLibraryStore';
import { getIsOfflineMode } from './useOfflineModeStore';

export const usePlaylists = () => {
	const { playlists, setPlaylists } = useLibraryStore();
	const [isLoading, setIsLoading] = useState(false);
	const hasFetched = useRef(false);

	const loadPlaylists = useCallback(async () => {
		if (hasFetched.current || isLoading || getIsOfflineMode()) return;
		setIsLoading(true);
		try {
			const fetchedPlaylists = await fetchAllPlaylists();
			setPlaylists(fetchedPlaylists);
			hasFetched.current = true;
		} catch (error) {
			console.error('Failed to load playlists:', error);
		} finally {
			setIsLoading(false);
		}
	}, [isLoading, setPlaylists]);

	const refreshPlaylists = useCallback(async () => {
		if (getIsOfflineMode()) return;
		hasFetched.current = false;
		setIsLoading(true);
		try {
			const fetchedPlaylists = await fetchAllPlaylists();
			setPlaylists(fetchedPlaylists);
			hasFetched.current = true;
		} catch (error) {
			console.error('Failed to refresh playlists:', error);
		} finally {
			setIsLoading(false);
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

	// Auto-load playlists on mount
	useEffect(() => {
		loadPlaylists();
	}, [loadPlaylists]);

	return {
		playlists,
		isLoading,
		loadPlaylists,
		loadPlaylistTracks,
		refreshPlaylists,
	};
};
