import { create } from 'zustand';
import { storage } from '@/lib/storage';

const STORAGE_KEY = 'DEV_SHOW_PERFORMANCE_DEBUGGER';

interface DevSettingsState {
	showPerformanceDebugger: boolean;
	hydrated: boolean;
	setShowPerformanceDebugger: (value: boolean) => void;
	hydrate: () => void;
}

export const useDevSettingsStore = create<DevSettingsState>((set, _get) => ({
	showPerformanceDebugger: false,
	hydrated: false,

	setShowPerformanceDebugger: (value: boolean) => {
		set({ showPerformanceDebugger: value });
		storage.set(STORAGE_KEY, value ? '1' : '0');
	},

	hydrate: () => {
		try {
			const raw = storage.getString(STORAGE_KEY);
			const show = raw === '1';
			set({ showPerformanceDebugger: show, hydrated: true });
		} catch {
			set({ hydrated: true });
		}
	},
}));
