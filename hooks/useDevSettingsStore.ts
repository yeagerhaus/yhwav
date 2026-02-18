import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'DEV_SHOW_PERFORMANCE_DEBUGGER';

interface DevSettingsState {
	showPerformanceDebugger: boolean;
	hydrated: boolean;
	setShowPerformanceDebugger: (value: boolean) => void;
	hydrate: () => Promise<void>;
}

export const useDevSettingsStore = create<DevSettingsState>((set, _get) => ({
	showPerformanceDebugger: false,
	hydrated: false,

	setShowPerformanceDebugger: (value: boolean) => {
		set({ showPerformanceDebugger: value });
		AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0').catch(() => {});
	},

	hydrate: async () => {
		try {
			const raw = await AsyncStorage.getItem(STORAGE_KEY);
			const show = raw === '1';
			set({ showPerformanceDebugger: show, hydrated: true });
		} catch {
			set({ hydrated: true });
		}
	},
}));
