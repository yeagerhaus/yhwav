import { create } from 'zustand';
import { storage } from '@/lib/storage';
import { STORAGE_POSITION_KEY } from './useAudioStore';

let positionSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export const usePlaybackProgressStore = create<{
	position: number;
	duration: number;
	setPosition: (p: number) => void;
	setDuration: (d: number) => void;
}>((set) => ({
	position: 0,
	duration: 0,
	setPosition: (position) => {
		set({ position });
		if (positionSaveTimeout) clearTimeout(positionSaveTimeout);
		positionSaveTimeout = setTimeout(() => {
			storage.set(STORAGE_POSITION_KEY, String(position));
			positionSaveTimeout = null;
		}, 2000);
	},
	setDuration: (duration) => set({ duration }),
}));
