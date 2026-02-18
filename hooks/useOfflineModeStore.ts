import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'OFFLINE_MODE';

interface OfflineModeState {
	offlineMode: boolean;
	hydrated: boolean;
	setOfflineMode: (value: boolean) => void;
	hydrate: () => Promise<void>;
}

export const useOfflineModeStore = create<OfflineModeState>((set) => ({
	offlineMode: false,
	hydrated: false,

	setOfflineMode: (value: boolean) => {
		set({ offlineMode: value });
		AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0').catch(() => {});
	},

	hydrate: async () => {
		try {
			const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
