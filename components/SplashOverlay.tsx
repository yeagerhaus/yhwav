import * as ExpoSplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';

// Match the native splash backgroundColor in app.config.ts
const SPLASH_BG = '#000000';

const BAR_MAX_HEIGHT = 52;
const BAR_WIDTH = 4;
const BAR_MIN_HEIGHT = 3;
const FADE_DURATION = 550;

// Symmetric pyramid shape — tallest bar in the center
const BAR_CONFIGS = [
	{ duration: 840, delay: 0, target: 0.36 },
	{ duration: 640, delay: 50, target: 0.58 },
	{ duration: 760, delay: 120, target: 0.78 },
	{ duration: 540, delay: 200, target: 0.68 },
	{ duration: 920, delay: 280, target: 1.0 },
	{ duration: 540, delay: 200, target: 0.68 },
	{ duration: 760, delay: 120, target: 0.78 },
	{ duration: 640, delay: 50, target: 0.58 },
	{ duration: 840, delay: 0, target: 0.36 },
] as const;

function VisualizerBars({ color }: { color: string }) {
	const anims = useRef(BAR_CONFIGS.map(() => new Animated.Value(BAR_MIN_HEIGHT))).current;
	const loopsRef = useRef<Animated.CompositeAnimation[]>([]);
	const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	useEffect(() => {
		const loops = anims.map((anim, i) => {
			const { duration, delay, target } = BAR_CONFIGS[i];
			const loop = Animated.loop(
				Animated.sequence([
					Animated.timing(anim, {
						toValue: target * BAR_MAX_HEIGHT,
						duration: Math.round(duration * 0.55),
						useNativeDriver: false,
					}),
					Animated.timing(anim, {
						toValue: BAR_MIN_HEIGHT,
						duration: Math.round(duration * 0.45),
						useNativeDriver: false,
					}),
				]),
			);
			const t = setTimeout(() => loop.start(), delay);
			timeoutsRef.current.push(t);
			return loop;
		});
		loopsRef.current = loops;

		return () => {
			loops.forEach((l) => l.stop());
			timeoutsRef.current.forEach(clearTimeout);
			loopsRef.current = [];
			timeoutsRef.current = [];
		};
	}, [anims]);

	return (
		<View style={styles.barsRow}>
			{anims.map((anim, i) => (
				<Animated.View key={i} style={[styles.bar, { backgroundColor: color, height: anim }]} />
			))}
		</View>
	);
}

export function SplashOverlay() {
	const hasInitialized = useLibraryStore((s) => s.hasInitialized);
	const brandColor = useAppearanceStore((s) => s.brandColor) ?? '#7f62f5';
	const overlayOpacity = useRef(new Animated.Value(1)).current;
	const [visible, setVisible] = useState(true);

	// Hide the native splash as soon as our overlay is painted — same bg colour
	// makes the swap seamless.
	useEffect(() => {
		ExpoSplashScreen.hideAsync().catch(() => {});
	}, []);

	// Fade out once all stores and the player have finished initialising.
	useEffect(() => {
		if (!hasInitialized) return;
		Animated.timing(overlayOpacity, {
			toValue: 0,
			duration: FADE_DURATION,
			useNativeDriver: true,
		}).start(() => setVisible(false));
	}, [hasInitialized, overlayOpacity]);

	if (!visible) return null;

	return (
		<Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
			<Image source={require('@/assets/images/splash-icon.png')} style={styles.icon} resizeMode='contain' />
			<VisualizerBars color={brandColor} />
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: SPLASH_BG,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 36,
		zIndex: 9999,
	},
	icon: {
		width: 100,
		height: 100,
		borderRadius: 22,
	},
	barsRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 6,
		height: BAR_MAX_HEIGHT,
	},
	bar: {
		width: BAR_WIDTH,
		borderRadius: 2,
	},
});
