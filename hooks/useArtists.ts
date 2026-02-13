import { useLibraryStore } from '@/hooks/useLibraryStore';

export const useArtists = () => {
	const artists = useLibraryStore((s) => s.artists);
	const artistsById = useLibraryStore((s) => s.artistsById);

	return {
		artists,
		artistsById,
	};
};
