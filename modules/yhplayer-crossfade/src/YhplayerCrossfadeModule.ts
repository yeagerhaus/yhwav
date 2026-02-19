import { requireOptionalNativeModule } from 'expo';

export interface Track {
	id: string;
	url: string;
	title?: string;
	artist?: string;
	artwork?: string;
	duration?: number;
}

export interface PlaybackState {
	state: string;
	position: number;
	duration: number;
	buffered?: number;
}

export interface CrossfadeConfig {
	enabled?: boolean;
	defaultDuration?: number;
	minDuration?: number;
	maxDuration?: number;
	fadeOnManualSkip?: boolean;
	manualSkipFadeDuration?: number;
}

type YhplayerCrossfadeModuleType = {
	setupPlayer: (options?: Record<string, unknown>) => Promise<void>;
	updateOptions: (options?: Record<string, unknown>) => Promise<void>;
	add: (tracks: Track[], insertAfterIndex?: number) => Promise<void>;
	reset: () => Promise<void>;
	remove: (indices: number[]) => Promise<void>;
	removeUpcomingTracks: () => Promise<void>;
	move: (fromIndex: number, toIndex: number) => Promise<void>;
	skip: (index: number) => Promise<void>;
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
	getPlaybackState: () => PlaybackState;
	getActiveTrackIndex: () => number;
	getQueue: () => Track[];
	addListener: (event: string, callback: (payload: unknown) => void) => { remove: () => void };
	removeListeners: (count: number) => void;

	setCrossfadeConfig: (config: CrossfadeConfig) => Promise<void>;
	setNextCrossfadeDuration: (seconds: number) => Promise<void>;
};

export default requireOptionalNativeModule<YhplayerCrossfadeModuleType>('YhplayerCrossfade');
