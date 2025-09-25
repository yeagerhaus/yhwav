import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
	...config,
	name: 'yhplayer',
	slug: 'yhplayer',
	version: '1.0.0',
	orientation: 'portrait',
	icon: './assets/images/icon.png',
	scheme: 'myapp',
	userInterfaceStyle: 'automatic',
	newArchEnabled: false,
	splash: {
		image: './assets/images/splash.png',
		resizeMode: 'contain',
		backgroundColor: '#000000',
	},
	ios: {
		supportsTablet: true,
		bundleIdentifier: 'com.alpineiq.yhplayer',
	},
	android: {
		adaptiveIcon: {
			foregroundImage: './assets/images/adaptive-icon.png',
			backgroundColor: '#ffffff',
		},
		package: 'com.alpineiq.yhplayer',
	},
	web: {
		bundler: 'metro',
		output: 'static',
		favicon: './assets/images/favicon.png',
	},
	plugins: [
		'expo-router',
		[
			'expo-splash-screen',
			{
				image: './assets/images/splash-icon.png',
				imageWidth: 200,
				resizeMode: 'contain',
				backgroundColor: '#ffffff',
				preventAutoHide: true,
			},
		],
		'expo-font',
		'expo-web-browser',
	],
	experiments: {
		typedRoutes: true,
	},
	extra: {
		...config.extra,
		EXPO_PUBLIC_PLEX_SERVER: process.env.EXPO_PUBLIC_PLEX_SERVER,
		EXPO_PUBLIC_PLEX_TOKEN: process.env.EXPO_PUBLIC_PLEX_TOKEN,
		EXPO_PUBLIC_PLEX_MUSIC_SECTION_ID: process.env.EXPO_PUBLIC_PLEX_MUSIC_SECTION_ID,
		EXPO_PUBLIC_PLEX_CLIENT_ID: process.env.EXPO_PUBLIC_PLEX_CLIENT_ID,
	},
});
