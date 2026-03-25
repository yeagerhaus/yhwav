import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { saveLibraryToCache } from '@/utils/cache';
import { fetchAllTracks } from '@/utils/plex';
import { useLibraryStore } from './useLibraryStore';

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
			// Defer cache save so the UI renders before JSON.stringify blocks
			InteractionManager.runAfterInteractions(() => {
				saveLibraryToCache();
			});
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
