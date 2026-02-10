/**
 * React hook to access external library store
 * This bridges the external store (outside React) with React components
 */

import { useEffect, useState } from 'react';
import { libraryStore } from '@/utils/library-store';
import type { Album, Artist, Song } from '@/types';

/**
 * Hook to access library store with automatic subscription
 * Only re-renders when data actually changes
 */
export function useExternalLibrary() {
	const [, forceUpdate] = useState(0);

	useEffect(() => {
		// Subscribe to store changes
		const unsubscribe = libraryStore.subscribe(() => {
			forceUpdate((x) => x + 1);
		});

		return unsubscribe;
	}, []);

	return {
		// Direct access methods (no React state)
		getTracks: () => libraryStore.getTracks(),
		getTrack: (id: string) => libraryStore.getTrack(id),
		getAlbums: () => libraryStore.getAlbums(),
		getAlbum: (id: string) => libraryStore.getAlbum(id),
		getArtists: () => libraryStore.getArtists(),
		getArtist: (name: string) => libraryStore.getArtist(name),
		getIndexes: () => libraryStore.getIndexes(),
		searchTracks: (query: string, limit?: number) => libraryStore.searchTracks(query, limit),
		
		// Reactive values (trigger re-renders)
		trackCount: libraryStore.getTrackCount(),
		isIndexing: libraryStore.getIsIndexing(),
		
		// Actions
		setTracks: (songs: Song[]) => libraryStore.setTracks(songs),
	};
}

/**
 * Hook to get only track count (minimal re-render)
 */
export function useTrackCount() {
	const [count, setCount] = useState(libraryStore.getTrackCount());
	const [isIndexing, setIsIndexing] = useState(libraryStore.getIsIndexing());

	useEffect(() => {
		const unsubscribe = libraryStore.subscribe(() => {
			setCount(libraryStore.getTrackCount());
			setIsIndexing(libraryStore.getIsIndexing());
		});

		return unsubscribe;
	}, []);

	return { count, isIndexing };
}

/**
 * Hook to get tracks with selector (only re-renders when selector result changes)
 */
export function useTracksSelector<T>(selector: (tracks: Song[]) => T): T {
	const [value, setValue] = useState(() => selector(libraryStore.getTracks()));

	useEffect(() => {
		const unsubscribe = libraryStore.subscribe(() => {
			const newValue = selector(libraryStore.getTracks());
			setValue((prev) => {
				// Only update if value actually changed
				if (JSON.stringify(prev) !== JSON.stringify(newValue)) {
					return newValue;
				}
				return prev;
			});
		});

		return unsubscribe;
	}, [selector]);

	return value;
}

