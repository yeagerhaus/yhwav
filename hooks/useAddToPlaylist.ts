import { create } from 'zustand';

interface AddToPlaylistState {
	visible: boolean;
	/** Display label shown in the modal subtitle */
	label: string;
	/** Rating keys of the tracks to add */
	ratingKeys: string[];
	open: (label: string, ratingKeys: string[]) => void;
	close: () => void;
}

export const useAddToPlaylist = create<AddToPlaylistState>((set) => ({
	visible: false,
	label: '',
	ratingKeys: [],
	open: (label, ratingKeys) => set({ visible: true, label, ratingKeys }),
	close: () => set({ visible: false, label: '', ratingKeys: [] }),
}));
