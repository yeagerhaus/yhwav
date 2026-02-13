/**
 * React hook to access external library store
 * This bridges the external store (outside React) with React components
 */

import { useEffect, useState } from 'react';
import type { Song } from '@/types';
import { libraryStore } from '@/utils/library-store';

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
		getIndexes: () => libraryStore.getIndexes(),
		searchTracks: (query: string, limit?: number) => libraryStore.searchTracks(query, limit),

		// Reactive values (trigger re-renders)
		trackCount: libraryStore.getTrackCount(),

		// Actions
		setTracks: (songs: Song[]) => libraryStore.setTracks(songs),
	};
}

/**
 * Hook to get only track count (minimal re-render)
 */
export function useTrackCount() {
	const [count, setCount] = useState(libraryStore.getTrackCount());

	useEffect(() => {
		const unsubscribe = libraryStore.subscribe(() => {
			setCount(libraryStore.getTrackCount());
		});

		return unsubscribe;
	}, []);

	return { count };
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
