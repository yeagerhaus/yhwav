import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllArtists } from '@/utils/plex';

export interface ArtistData {
	key: string;
	title: string;
	artwork?: string;
	thumb?: string;
}

export const useArtists = () => {
	const [artists, setArtists] = useState<ArtistData[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const hasFetched = useRef(false);

	const loadArtists = useCallback(async () => {
		if (hasFetched.current || isLoading) return;
		setIsLoading(true);
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
			hasFetched.current = true;
		} catch (error) {
			console.error('Failed to load artists:', error);
		} finally {
			setIsLoading(false);
		}
	}, [isLoading]);

	// Auto-load artists on mount
	useEffect(() => {
		loadArtists();
	}, [loadArtists]);

	return {
		artists,
		isLoading,
		loadArtists,
	};
};

