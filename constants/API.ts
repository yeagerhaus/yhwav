import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web',
	isDroid = Platform.OS === 'android',
	isIOS = Platform.OS === 'ios',
	isLocal = __DEV__ || (isWeb && location.hostname.endsWith('localhost')),
	isDemo = isWeb && location.search?.includes('demo=true'),
	appVersion = `1.0-${Platform.OS}-${Device.osVersion}-${Device.modelName ?? 'N/A'}`,
	deviceType = `${Platform.OS}-${Device.modelName ?? 'N/A'}`,
	deviceOS = `${Device.osVersion}`;

export const apiURL = isLocal ? 'http://localhost:8080/' : 'https://api.example.com/';
