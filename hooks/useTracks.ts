import { useCallback, useEffect } from 'react';
import { fetchAllTracks } from '@/utils/plex';
import { useLibraryStore } from './useLibraryStore';
import { saveLibraryToCache } from '@/utils/cache';

export const useTracks = () => {
	const { tracks, setTracks, isLibraryLoading, setLibraryLoading } = useLibraryStore();

	const loadTracks = useCallback(async () => {
		if (tracks.length === 0 && !isLibraryLoading) {
			setLibraryLoading(true);
			try {
				const fetchedTracks = await fetchAllTracks();
				setTracks(fetchedTracks);
				// Save to cache for faster subsequent loads
				await saveLibraryToCache();
			} catch (error) {
				console.error('Failed to load tracks:', error);
			} finally {
				setLibraryLoading(false);
			}
		}
	}, [tracks.length, isLibraryLoading, setTracks, setLibraryLoading]);

	// Auto-load tracks on mount
	useEffect(() => {
		loadTracks();
	}, [loadTracks]);

	return {
		tracks,
		isLoading: isLibraryLoading,
		loadTracks,
	};
};

