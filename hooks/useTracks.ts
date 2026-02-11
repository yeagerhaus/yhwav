import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllTracks } from '@/utils/plex';
import { useLibraryStore } from './useLibraryStore';
import { saveLibraryToCache } from '@/utils/cache';

export const useTracks = () => {
	const { tracks, setTracks } = useLibraryStore();
	const [isLoading, setIsLoading] = useState(false);
	const hasFetched = useRef(false);

	const loadTracks = useCallback(async () => {
		if (hasFetched.current || isLoading) return;
		setIsLoading(true);
		try {
			const fetchedTracks = await fetchAllTracks();
			setTracks(fetchedTracks);
			hasFetched.current = true;
			// Save to cache for faster subsequent loads
			await saveLibraryToCache();
		} catch (error) {
			console.error('Failed to load tracks:', error);
		} finally {
			setIsLoading(false);
		}
	}, [isLoading, setTracks]);

	// Auto-load tracks on mount
	useEffect(() => {
		loadTracks();
	}, [loadTracks]);

	return {
		tracks,
		isLoading,
		loadTracks,
	};
};

