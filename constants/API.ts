import { Platform } from 'react-native';

/** Platform helpers for shared constants. There is no app backend URL — clients use the user’s Plex server. */
export const isWeb = Platform.OS === 'web';
