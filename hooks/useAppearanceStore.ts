import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'APPEARANCE_SETTINGS';

interface AppearanceState {
	showPodcastsTab: boolean;
	hydrated: boolean;
	setShowPodcastsTab: (show: boolean) => void;
	hydrate: () => Promise<void>;
}

export const useAppearanceStore = create<AppearanceState>((set, _get) => ({
	showPodcastsTab: true,
	hydrated: false,

	setShowPodcastsTab: (show: boolean) => {
		set({ showPodcastsTab: show });
		AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ showPodcastsTab: show })).catch(() => {});
	},

	hydrate: async () => {
		try {
			const raw = await AsyncStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				set({ showPodcastsTab: parsed.showPodcastsTab ?? true });
			}
		} catch {}
		set({ hydrated: true });
	},
}));
