import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'APPEARANCE_SETTINGS';

const DEFAULT_BRAND = '#7f62f5';

interface StoredAppearance {
	showPodcastsTab?: boolean;
	showMusicTab?: boolean;
	brandColor?: string | null;
	useBlurInsteadOfGlass?: boolean;
}

async function persistAppearance(partial: StoredAppearance) {
	try {
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		const current: StoredAppearance = raw ? JSON.parse(raw) : {};
		const next = { ...current, ...partial };
		await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {}
}

interface AppearanceState {
	showPodcastsTab: boolean;
	showMusicTab: boolean;
	brandColor: string | null;
	useBlurInsteadOfGlass: boolean;
	hydrated: boolean;
	setShowPodcastsTab: (show: boolean) => void;
	setShowMusicTab: (show: boolean) => void;
	setBrandColor: (color: string | null) => void;
	setUseBlurInsteadOfGlass: (use: boolean) => void;
	hydrate: () => Promise<void>;
}

export const DEFAULT_BRAND_COLOR = DEFAULT_BRAND;

export const useAppearanceStore = create<AppearanceState>((set, _get) => ({
	showPodcastsTab: true,
	showMusicTab: true,
	brandColor: null,
	useBlurInsteadOfGlass: false,
	hydrated: false,

	setShowPodcastsTab: (show: boolean) => {
		set({ showPodcastsTab: show });
		persistAppearance({ showPodcastsTab: show });
	},

	setShowMusicTab: (show: boolean) => {
		set({ showMusicTab: show });
		persistAppearance({ showMusicTab: show });
	},

	setBrandColor: (color: string | null) => {
		set({ brandColor: color });
		persistAppearance({ brandColor: color });
	},

	setUseBlurInsteadOfGlass: (use: boolean) => {
		set({ useBlurInsteadOfGlass: use });
		persistAppearance({ useBlurInsteadOfGlass: use });
	},

	hydrate: async () => {
		try {
			const raw = await AsyncStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed: StoredAppearance = JSON.parse(raw);
				set({
					showPodcastsTab: parsed.showPodcastsTab ?? true,
					showMusicTab: parsed.showMusicTab ?? true,
					brandColor: parsed.brandColor ?? null,
					useBlurInsteadOfGlass: parsed.useBlurInsteadOfGlass ?? false,
				});
			}
		} catch {}
		set({ hydrated: true });
	},
}));
