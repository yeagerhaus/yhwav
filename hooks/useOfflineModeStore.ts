import { create } from 'zustand';
import { storage } from '@/lib/storage';

const STORAGE_KEY = 'OFFLINE_MODE';

interface OfflineModeState {
	offlineMode: boolean;
	hydrated: boolean;
	setOfflineMode: (value: boolean) => void;
	hydrate: () => void;
}

export const useOfflineModeStore = create<OfflineModeState>((set) => ({
	offlineMode: false,
	hydrated: false,

	setOfflineMode: (value: boolean) => {
		set({ offlineMode: value });
		storage.set(STORAGE_KEY, value ? '1' : '0');
		if (!value) {
			import('@/utils/scrobble-queue').then(({ flushPendingScrobbles }) => flushPendingScrobbles().catch(() => {}));
		}
	},

	hydrate: () => {
		try {
			const raw = storage.getString(STORAGE_KEY);
			const offline = raw === '1';
			set({ offlineMode: offline, hydrated: true });
		} catch {
			set({ hydrated: true });
		}
	},
}));

/** Getter for use outside React (e.g. plex-client, cache, podcast store). */
export function getIsOfflineMode(): boolean {
	return useOfflineModeStore.getState().offlineMode;
}
