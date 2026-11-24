import { requireOptionalNativeModule } from 'expo';

export interface Track {
	id: string;
	url: string;
	/** Direct Plex file URL when `url` is a transcode URL (native fallback if transcode is truncated). */
	directUrl?: string;
	title?: string;
	artist?: string;
	artwork?: string;
	duration?: number;
	/** Gapless handoff into this track even when Sweet Fades is enabled (e.g. podcasts). */
	crossfadeDisabled?: boolean;
	/** Per-track loudness gain in dB (ReplayGain), applied natively when normalization is enabled. */
	gainDb?: number;
}

/** 0 equal-power, 1 linear, 2 logarithmic, 3 S-curve. */
export type CrossfadeCurve = 0 | 1 | 2 | 3;

export interface CrossfadeConfig {
	enabled: boolean;
	defaultDuration: number;
	minDuration: number;
	maxDuration: number;
	fadeInOnManualSkip: boolean;
	manualSkipFadeDuration: number;
	curve: CrossfadeCurve;
	lowpassTail: boolean;
}

export interface PlaybackState {
	state: string;
	position: number;
	duration: number;
	buffered?: number;
}

type YhwavAudioModuleType = {
	setupPlayer: (options?: Record<string, unknown>) => Promise<void>;
	updateOptions: (options?: Record<string, unknown>) => Promise<void>;
	add: (tracks: Track[], insertAfterIndex?: number) => Promise<void>;
	reset: () => Promise<void>;
	remove: (indices: number[]) => Promise<void>;
	removeUpcomingTracks: () => Promise<void>;
	move: (fromIndex: number, toIndex: number) => Promise<void>;
	skip: (index: number, startPaused?: boolean, startAtSeconds?: number) => Promise<void>;
	play: () => Promise<void>;
	pause: () => Promise<void>;
	seekTo: (position: number) => Promise<void>;
	setVolume: (value: number) => Promise<void>;
	setRate: (value: number) => Promise<void>;
	setRepeatMode: (mode: number) => Promise<void>;
	setEqualizerBands: (bands: Array<{ frequency: number; gain: number }>) => Promise<void>;
	setEqualizerEnabled: (enabled: boolean) => Promise<void>;
	setOutputGain: (gainDb: number) => Promise<void>;
	setNormalizationEnabled: (enabled: boolean) => Promise<void>;
	setMonoAudioEnabled: (enabled: boolean) => Promise<void>;
	setCrossfadeConfig: (config: CrossfadeConfig) => Promise<void>;
	setNextCrossfadeDuration: (seconds: number) => Promise<void>;
	setNextCrossfadeTrim: (trim: number) => Promise<void>;
	getPlaybackState: () => Promise<PlaybackState>;
	getActiveTrackIndex: () => Promise<number>;
	getQueue: () => Promise<Track[]>;
	prewarmURL: (url: string, trackId: string) => Promise<void>;
	/** Decodes the audio at `url` and returns `buckets` normalized peak amplitudes (0..1). */
	computeWaveform: (url: string, buckets: number) => Promise<number[]>;
	/** Marks a file or directory (path or file:// URI) as excluded from iCloud/iTunes backup. */
	excludeFromBackup: (pathOrUri: string) => Promise<void>;
	/** Drops every cached/streamed audio file (e.g. on logout). */
	clearAudioCache: () => Promise<void>;
	/** `epoch` increases per build; native ignores a build older than the newest it has applied. */
	buildSearchIndex: (tracks: Array<{ id: string; title: string; artist: string; album: string }>, epoch: number) => Promise<void>;
	searchTracks: (query: string, limit: number) => Promise<Array<{ id: string; score: number }>>;
	addListener: (event: string, callback: (payload: unknown) => void) => { remove: () => void };
	removeListeners: (count: number) => void;
};

export default requireOptionalNativeModule<YhwavAudioModuleType>('YhwavAudio');
