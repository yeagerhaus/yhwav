import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Album } from '@/types';
import { fetchAllAlbums } from '@/utils/plex';

export const useAlbums = () => {
	const [albums, setAlbums] = useState<Album[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const hasFetched = useRef(false);

	const loadAlbums = useCallback(async () => {
		if (hasFetched.current || isLoading) return;
		setIsLoading(true);
		try {
			const fetched = await fetchAllAlbums();
			setAlbums(fetched);
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

	const albumsById = useMemo(() => {
		const map: Record<string, Album> = {};
		for (const album of albums) {
			map[album.id] = album;
		}
		return map;
	}, [albums]);

	const getAlbumsByArtist = useCallback(
		(artistKey: string) => {
			return albums.filter((album) => album.artistKey === artistKey);
		},
		[albums],
	);

	return {
		albums,
		albumsById,
		getAlbumsByArtist,
		isLoading,
		loadAlbums,
	};
};
