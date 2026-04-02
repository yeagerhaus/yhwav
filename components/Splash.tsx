import * as ExpoSplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, useColorScheme } from 'react-native';
import { useLibraryStore } from '@/hooks/useLibraryStore';

const lightSplash = require('../assets/images/lightSplash.png');
const darkSplash = require('../assets/images/darkSplash.png');

/** Backing color while the image opacity fades in (matches splash PNG backgrounds). */
const SPLASH_BACKDROP = {
	light: '#ECECEA',
	dark: '#0A0A12',
} as const;

const FADE_IN_MS = 1500;
const FADE_OUT_MS = 1500;

export function SplashOverlay() {
	const hasInitialized = useLibraryStore((s) => s.hasInitialized);
	const colorScheme = useColorScheme();
	const isDark = colorScheme === 'dark';

	const enterOpacity = useRef(new Animated.Value(0)).current;
	const exitOpacity = useRef(new Animated.Value(1)).current;
	const [visible, setVisible] = useState(true);

	useEffect(() => {
		ExpoSplashScreen.hideAsync().catch(() => {});
	}, []);

	useEffect(() => {
		enterOpacity.setValue(0);
		Animated.timing(enterOpacity, {
			toValue: 1,
			duration: FADE_IN_MS,
			useNativeDriver: true,
		}).start();
	}, [isDark, enterOpacity]);

	useEffect(() => {
		if (!hasInitialized) return;
		Animated.timing(exitOpacity, {
			toValue: 0,
			duration: FADE_OUT_MS,
			useNativeDriver: true,
		}).start(() => setVisible(false));
	}, [hasInitialized, exitOpacity]);

	if (!visible) return null;

	const backdrop = isDark ? SPLASH_BACKDROP.dark : SPLASH_BACKDROP.light;

	return (
		<Animated.View style={[styles.overlay, { opacity: exitOpacity, backgroundColor: backdrop }]}>
			<Animated.Image
				source={isDark ? darkSplash : lightSplash}
				style={[styles.image, { opacity: enterOpacity }]}
				resizeMode='cover'
			/>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		zIndex: 9999,
	},
	image: {
		...StyleSheet.absoluteFillObject,
		width: undefined,
		height: undefined,
	},
});
