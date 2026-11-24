import { AppState } from 'react-native';
import { create } from 'zustand';
import { storage } from '@/lib/storage';
import { STORAGE_POSITION_KEY } from './useAudioStore';

/**
 * Throttled (not debounced) persistence: progress events arrive every 0.5 s, so a debounce kept
 * resetting and only wrote once updates stopped — killing the app mid-track lost the position.
 */
const POSITION_WRITE_INTERVAL_MS = 5000;
let lastPositionWriteAt = 0;
let latestPosition = 0;

/** Write the latest position now (on pause, backgrounding, etc.). */
export function flushPlaybackPosition(): void {
	storage.set(STORAGE_POSITION_KEY, String(latestPosition));
	lastPositionWriteAt = Date.now();
}

AppState.addEventListener('change', (state) => {
	if (state !== 'active' && latestPosition > 0) flushPlaybackPosition();
});

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
		latestPosition = position;
		const now = Date.now();
		if (now - lastPositionWriteAt >= POSITION_WRITE_INTERVAL_MS) {
			storage.set(STORAGE_POSITION_KEY, String(position));
			lastPositionWriteAt = now;
		}
	},
	setDuration: (duration) => set({ duration }),
}));
