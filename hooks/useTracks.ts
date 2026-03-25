import { useLibraryStore } from './useLibraryStore';

export const useTracks = () => {
	const tracks = useLibraryStore((s) => s.tracks);
	return { tracks };
};
