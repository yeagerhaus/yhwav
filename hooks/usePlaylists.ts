import { useCallback, useEffect } from 'react';
import { fetchAllPlaylists, fetchPlaylistTracks } from '@/utils/plex';
import { useLibraryStore } from './useLibraryStore';

export const usePlaylists = () => {
	const { playlists, setPlaylists, isLibraryLoading, setLibraryLoading } = useLibraryStore();

	const loadPlaylists = useCallback(async () => {
		if (playlists.length === 0 && !isLibraryLoading) {
			setLibraryLoading(true);
			try {
				const fetchedPlaylists = await fetchAllPlaylists();
				setPlaylists(fetchedPlaylists);
			} catch (error) {
				console.error('Failed to load playlists:', error);
			} finally {
				setLibraryLoading(false);
			}
		}
	}, [playlists.length, isLibraryLoading, setPlaylists, setLibraryLoading]);

	const loadPlaylistTracks = useCallback(async (playlistId: string) => {
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
		isLoading: isLibraryLoading,
		loadPlaylists,
		loadPlaylistTracks,
	};
};
