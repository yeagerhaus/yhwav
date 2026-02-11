import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Artist } from '@/types';
import { fetchAllArtists } from '@/utils/plex';

export const useArtists = () => {
	const [artists, setArtists] = useState<Artist[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const hasFetched = useRef(false);

	const loadArtists = useCallback(async () => {
		if (hasFetched.current || isLoading) return;
		setIsLoading(true);
		try {
			const fetched = await fetchAllArtists();
			setArtists(fetched);
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

	const artistsById = useMemo(() => {
		const map: Record<string, Artist> = {};
		for (const artist of artists) {
			map[artist.key] = artist;
		}
		return map;
	}, [artists]);

	return {
		artists,
		artistsById,
		isLoading,
		loadArtists,
	};
};
