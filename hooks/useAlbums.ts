import { useCallback, useEffect, useState } from 'react';
import { fetchAllAlbums } from '@/utils/plex';
import { useLibraryStore } from './useLibraryStore';

export interface AlbumData {
	key: string;
	title: string;
	artist: string;
	artwork?: string;
	thumb?: string;
	year?: number;
}

export const useAlbums = () => {
	const { isLibraryLoading, setLibraryLoading } = useLibraryStore();
	const [albums, setAlbums] = useState<AlbumData[]>([]);

	const loadAlbums = useCallback(async () => {
		if (albums.length === 0 && !isLibraryLoading) {
			setLibraryLoading(true);
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
			} catch (error) {
				console.error('Failed to load albums:', error);
			} finally {
				setLibraryLoading(false);
			}
		}
	}, [albums.length, isLibraryLoading, setLibraryLoading]);

	// Auto-load albums on mount
	useEffect(() => {
		loadAlbums();
	}, [loadAlbums]);

	return {
		albums,
		isLoading: isLibraryLoading,
		loadAlbums,
	};
};

