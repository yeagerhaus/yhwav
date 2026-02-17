import { Platform } from 'react-native';
import YhplayerAudioModule from './YhplayerAudioModule';

export const isAvailable = (): boolean => {
	return Platform.OS === 'ios' && YhplayerAudioModule != null;
};

export {
	default as YhplayerAudioModule,
	type PlaybackState,
	type Track,
} from './YhplayerAudioModule';
