import { Platform } from 'react-native';
import YhwavAudioModule from './YhwavAudioModule';

export const isAvailable = (): boolean => {
	return Platform.OS === 'ios' && YhwavAudioModule != null;
};

export {
	default as YhwavAudioModule,
	type PlaybackState,
	type Track,
} from './YhwavAudioModule';
