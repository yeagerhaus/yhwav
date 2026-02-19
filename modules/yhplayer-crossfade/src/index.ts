import { Platform } from 'react-native';
import YhplayerCrossfadeModule from './YhplayerCrossfadeModule';

export const isAvailable = (): boolean => {
	return Platform.OS === 'ios' && YhplayerCrossfadeModule != null;
};

export {
	default as YhplayerCrossfadeModule,
	type CrossfadeConfig,
	type PlaybackState,
	type Track,
} from './YhplayerCrossfadeModule';
