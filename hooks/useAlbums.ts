import { useCallback } from 'react';
import { useLibraryStore } from '@/hooks/useLibraryStore';

export const useAlbums = () => {
	const albums = useLibraryStore((s) => s.albums);
	const albumsById = useLibraryStore((s) => s.albumsById);

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
	};
};
