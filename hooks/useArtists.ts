import { useCallback, useEffect, useState } from 'react';
import { fetchAllArtists } from '@/utils/plex';
import { useLibraryStore } from './useLibraryStore';

export interface ArtistData {
	key: string;
	title: string;
	artwork?: string;
	thumb?: string;
}

export const useArtists = () => {
	const { isLibraryLoading, setLibraryLoading } = useLibraryStore();
	const [artists, setArtists] = useState<ArtistData[]>([]);

	const loadArtists = useCallback(async () => {
		if (artists.length === 0 && !isLibraryLoading) {
			setLibraryLoading(true);
			try {
				const fetchedArtists = await fetchAllArtists();
				// Format artists from Plex response
				const formatted = fetchedArtists.map((artist: any) => ({
					key: artist.ratingKey,
					title: artist.title,
					artwork: artist.thumb,
					thumb: artist.thumb,
				}));
				setArtists(formatted);
			} catch (error) {
				console.error('Failed to load artists:', error);
			} finally {
				setLibraryLoading(false);
			}
		}
	}, [artists.length, isLibraryLoading, setLibraryLoading]);

	// Auto-load artists on mount
	useEffect(() => {
		loadArtists();
	}, [loadArtists]);

	return {
		artists,
		isLoading: isLibraryLoading,
		loadArtists,
	};
};

