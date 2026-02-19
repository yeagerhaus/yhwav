import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import TrackPlayer from '@/lib/playerAdapter';

const STORAGE_EQ_ENABLED = 'PLAYBACK_EQ_ENABLED';
const STORAGE_EQ_BANDS = 'PLAYBACK_EQ_BANDS';
const STORAGE_EQ_PRESET = 'PLAYBACK_EQ_PRESET';
const STORAGE_OUTPUT_GAIN = 'PLAYBACK_OUTPUT_GAIN';
const STORAGE_NORMALIZATION = 'PLAYBACK_NORMALIZATION';
const STORAGE_MONO_AUDIO = 'PLAYBACK_MONO_AUDIO';
const STORAGE_CROSSFADE_ENABLED = 'PLAYBACK_CROSSFADE_ENABLED';
const STORAGE_CROSSFADE_DURATION = 'PLAYBACK_CROSSFADE_DURATION';
const STORAGE_CROSSFADE_ADAPTIVE = 'PLAYBACK_CROSSFADE_ADAPTIVE';

export interface EQBand {
	frequency: number;
	gain: number;
}

const DEFAULT_BANDS: EQBand[] = [
	{ frequency: 31, gain: 0 },
	{ frequency: 62, gain: 0 },
	{ frequency: 125, gain: 0 },
	{ frequency: 250, gain: 0 },
	{ frequency: 500, gain: 0 },
	{ frequency: 1000, gain: 0 },
	{ frequency: 2000, gain: 0 },
	{ frequency: 4000, gain: 0 },
	{ frequency: 8000, gain: 0 },
	{ frequency: 16000, gain: 0 },
];

export const EQ_PRESETS: Record<string, number[]> = {
	Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	Rock: [4, 3, 1, -1, -2, 1, 3, 4, 4, 3],
	Pop: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
	Jazz: [3, 2, 0, 2, -2, -2, 0, 2, 3, 3],
	Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
	'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
	'Treble Boost': [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
	'Vocal Boost': [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
};

export function formatFrequency(hz: number): string {
	return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
}

interface PlaybackSettingsState {
	hydrated: boolean;
	equalizerEnabled: boolean;
	equalizerBands: EQBand[];
	selectedPreset: string | null;
	outputGainDb: number;
	normalizationEnabled: boolean;
	monoAudioEnabled: boolean;
	crossfadeEnabled: boolean;
	crossfadeDuration: number;
	crossfadeAdaptiveEnabled: boolean;

	hydrate: () => Promise<void>;
	setEqualizerEnabled: (enabled: boolean) => void;
	setBandGain: (index: number, gain: number) => void;
	setAllBands: (gains: number[]) => void;
	setPreset: (name: string) => void;
	resetEQ: () => void;
	setOutputGain: (db: number) => void;
	setNormalizationEnabled: (enabled: boolean) => void;
	setMonoAudioEnabled: (enabled: boolean) => void;
	setCrossfadeEnabled: (enabled: boolean) => void;
	setCrossfadeDuration: (seconds: number) => void;
	setCrossfadeAdaptiveEnabled: (enabled: boolean) => void;
}

function applyBandsToNative(bands: EQBand[]) {
	TrackPlayer.setEqualizerBands(bands).catch(() => {});
}

export const usePlaybackSettingsStore = create<PlaybackSettingsState>((set, get) => ({
	hydrated: false,
	equalizerEnabled: false,
	equalizerBands: DEFAULT_BANDS,
	selectedPreset: null,
	outputGainDb: 0,
	normalizationEnabled: false,
	monoAudioEnabled: false,
	crossfadeEnabled: false,
	crossfadeDuration: 4,
	crossfadeAdaptiveEnabled: true,

	hydrate: async () => {
		try {
			const [eqEnabledRaw, bandsRaw, presetRaw, gainRaw, normRaw, monoRaw, xfEnabledRaw, xfDurationRaw, xfAdaptiveRaw] = await Promise.all([
				AsyncStorage.getItem(STORAGE_EQ_ENABLED),
				AsyncStorage.getItem(STORAGE_EQ_BANDS),
				AsyncStorage.getItem(STORAGE_EQ_PRESET),
				AsyncStorage.getItem(STORAGE_OUTPUT_GAIN),
				AsyncStorage.getItem(STORAGE_NORMALIZATION),
				AsyncStorage.getItem(STORAGE_MONO_AUDIO),
				AsyncStorage.getItem(STORAGE_CROSSFADE_ENABLED),
				AsyncStorage.getItem(STORAGE_CROSSFADE_DURATION),
				AsyncStorage.getItem(STORAGE_CROSSFADE_ADAPTIVE),
			]);

			const eqEnabled = eqEnabledRaw === '1';
			const bands = bandsRaw ? JSON.parse(bandsRaw) : DEFAULT_BANDS;
			const preset = presetRaw || null;
			const gainDb = gainRaw ? Number.parseFloat(gainRaw) : 0;
			const normalization = normRaw === '1';
			const mono = monoRaw === '1';
			const crossfadeEnabled = xfEnabledRaw === '1';
			const crossfadeDuration = xfDurationRaw ? Number.parseFloat(xfDurationRaw) : 4;
			const crossfadeAdaptive = xfAdaptiveRaw !== '0'; // default true

			// Switch to crossfade engine before applying DSP settings
			if (crossfadeEnabled) {
				await TrackPlayer.switchEngine(true).catch(() => {});
			}

			set({
				hydrated: true,
				equalizerEnabled: eqEnabled,
				equalizerBands: bands,
				selectedPreset: preset,
				outputGainDb: gainDb,
				normalizationEnabled: normalization,
				monoAudioEnabled: mono,
				crossfadeEnabled,
				crossfadeDuration,
				crossfadeAdaptiveEnabled: crossfadeAdaptive,
			});

			TrackPlayer.setEqualizerEnabled(eqEnabled).catch(() => {});
			applyBandsToNative(bands);
			TrackPlayer.setOutputGain(gainDb).catch(() => {});
			TrackPlayer.setNormalizationEnabled(normalization).catch(() => {});
			TrackPlayer.setMonoAudioEnabled(mono).catch(() => {});
			if (crossfadeEnabled) {
				TrackPlayer.setCrossfadeConfig({
					enabled: true,
					defaultDuration: crossfadeDuration,
				}).catch(() => {});
			}
		} catch {
			set({ hydrated: true });
		}
	},

	setEqualizerEnabled: (enabled: boolean) => {
		set({ equalizerEnabled: enabled });
		TrackPlayer.setEqualizerEnabled(enabled).catch(() => {});
		AsyncStorage.setItem(STORAGE_EQ_ENABLED, enabled ? '1' : '0').catch(() => {});
	},

	setBandGain: (index: number, gain: number) => {
		const bands = [...get().equalizerBands];
		if (index < 0 || index >= bands.length) return;
		bands[index] = { ...bands[index], gain: Math.max(-12, Math.min(12, gain)) };
		set({ equalizerBands: bands, selectedPreset: null });
		applyBandsToNative(bands);
		AsyncStorage.setItem(STORAGE_EQ_BANDS, JSON.stringify(bands)).catch(() => {});
		AsyncStorage.removeItem(STORAGE_EQ_PRESET).catch(() => {});
	},

	setAllBands: (gains: number[]) => {
		const bands = get().equalizerBands.map((b, i) => ({
			...b,
			gain: Math.max(-12, Math.min(12, gains[i] ?? 0)),
		}));
		set({ equalizerBands: bands });
		applyBandsToNative(bands);
		AsyncStorage.setItem(STORAGE_EQ_BANDS, JSON.stringify(bands)).catch(() => {});
	},

	setPreset: (name: string) => {
		const gains = EQ_PRESETS[name];
		if (!gains) return;
		const bands = DEFAULT_BANDS.map((b, i) => ({ ...b, gain: gains[i] ?? 0 }));
		set({ equalizerBands: bands, selectedPreset: name });
		applyBandsToNative(bands);
		AsyncStorage.setItem(STORAGE_EQ_BANDS, JSON.stringify(bands)).catch(() => {});
		AsyncStorage.setItem(STORAGE_EQ_PRESET, name).catch(() => {});
	},

	resetEQ: () => {
		set({ equalizerBands: DEFAULT_BANDS, selectedPreset: 'Flat' });
		applyBandsToNative(DEFAULT_BANDS);
		AsyncStorage.setItem(STORAGE_EQ_BANDS, JSON.stringify(DEFAULT_BANDS)).catch(() => {});
		AsyncStorage.setItem(STORAGE_EQ_PRESET, 'Flat').catch(() => {});
	},

	setOutputGain: (db: number) => {
		const clamped = Math.max(-10, Math.min(10, Math.round(db * 10) / 10));
		set({ outputGainDb: clamped });
		TrackPlayer.setOutputGain(clamped).catch(() => {});
		AsyncStorage.setItem(STORAGE_OUTPUT_GAIN, String(clamped)).catch(() => {});
	},

	setNormalizationEnabled: (enabled: boolean) => {
		set({ normalizationEnabled: enabled });
		TrackPlayer.setNormalizationEnabled(enabled).catch(() => {});
		AsyncStorage.setItem(STORAGE_NORMALIZATION, enabled ? '1' : '0').catch(() => {});
	},

	setMonoAudioEnabled: (enabled: boolean) => {
		set({ monoAudioEnabled: enabled });
		TrackPlayer.setMonoAudioEnabled(enabled).catch(() => {});
		AsyncStorage.setItem(STORAGE_MONO_AUDIO, enabled ? '1' : '0').catch(() => {});
	},

	setCrossfadeEnabled: (enabled: boolean) => {
		set({ crossfadeEnabled: enabled });
		AsyncStorage.setItem(STORAGE_CROSSFADE_ENABLED, enabled ? '1' : '0').catch(() => {});
		TrackPlayer.switchEngine(enabled).then(() => {
			if (enabled) {
				const { crossfadeDuration } = get();
				TrackPlayer.setCrossfadeConfig({
					enabled: true,
					defaultDuration: crossfadeDuration,
				}).catch(() => {});
				// Re-apply DSP settings to the new engine
				const state = get();
				TrackPlayer.setEqualizerEnabled(state.equalizerEnabled).catch(() => {});
				applyBandsToNative(state.equalizerBands);
				TrackPlayer.setOutputGain(state.outputGainDb).catch(() => {});
				TrackPlayer.setNormalizationEnabled(state.normalizationEnabled).catch(() => {});
				TrackPlayer.setMonoAudioEnabled(state.monoAudioEnabled).catch(() => {});
			}
		}).catch(() => {});
	},

	setCrossfadeDuration: (seconds: number) => {
		const clamped = Math.max(1, Math.min(12, Math.round(seconds * 10) / 10));
		set({ crossfadeDuration: clamped });
		AsyncStorage.setItem(STORAGE_CROSSFADE_DURATION, String(clamped)).catch(() => {});
		TrackPlayer.setCrossfadeConfig({ defaultDuration: clamped }).catch(() => {});
	},

	setCrossfadeAdaptiveEnabled: (enabled: boolean) => {
		set({ crossfadeAdaptiveEnabled: enabled });
		AsyncStorage.setItem(STORAGE_CROSSFADE_ADAPTIVE, enabled ? '1' : '0').catch(() => {});
	},
}));
