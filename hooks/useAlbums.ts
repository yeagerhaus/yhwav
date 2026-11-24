import { useLibraryStore } from '@/hooks/useLibraryStore';

export const useAlbums = () => {
	const albums = useLibraryStore((s) => s.albums);
	const albumsById = useLibraryStore((s) => s.albumsById);

	return {
		albums,
		albumsById,
	};
};
