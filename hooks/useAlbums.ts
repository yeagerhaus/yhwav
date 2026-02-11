import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllAlbums } from '@/utils/plex';

export interface AlbumData {
	key: string;
	title: string;
	artist: string;
	artwork?: string;
	thumb?: string;
	year?: number;
}

export const useAlbums = () => {
	const [albums, setAlbums] = useState<AlbumData[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const hasFetched = useRef(false);

	const loadAlbums = useCallback(async () => {
		if (hasFetched.current || isLoading) return;
		setIsLoading(true);
		try {
			const fetchedAlbums = await fetchAllAlbums();
			// Format albums from Plex response
			const formatted = fetchedAlbums.map((album: any) => ({
				key: album.ratingKey,
				title: album.title,
				artist: album.parentTitle || '',
				artwork: album.thumb,
				thumb: album.thumb,
				year: album.year ? parseInt(album.year, 10) : undefined,
			}));
			setAlbums(formatted);
			hasFetched.current = true;
		} catch (error) {
			console.error('Failed to load albums:', error);
		} finally {
			setIsLoading(false);
		}
	}, [isLoading]);

	// Auto-load albums on mount
	useEffect(() => {
		loadAlbums();
	}, [loadAlbums]);

	return {
		albums,
		isLoading,
		loadAlbums,
	};
};

