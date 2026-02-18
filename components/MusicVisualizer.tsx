import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, useColorScheme } from 'react-native';
import { Div } from './Div';
import { Colors } from '@/constants/styles';
import { isAvailable, YhplayerAudioModule } from '@/modules/yhplayer-audio';

interface Props {
	isPlaying: boolean;
}

const BAR_COUNT = 5;
const ANIMATION_DURATION = 300;
const NATIVE_LEVEL_SMOOTH_MS = 80;

export function MusicVisualizer({ isPlaying }: Props) {
	const theme = useColorScheme();
	const animatedValues = useRef(new Array(BAR_COUNT).fill(0).map(() => new Animated.Value(0))).current;
	const [prominentBar, setProminentBar] = useState(0);
	const randomScales = useRef(new Array(BAR_COUNT).fill(0).map(() => 0.3 + Math.random() * 0.4)).current;
	const [useNativeLevels, setUseNativeLevels] = useState(false);
	const fallbackLoopRef = useRef<Animated.CompositeAnimation | null>(null);

	// Subscribe to real audio levels on iOS when playing
	useEffect(() => {
		if (!isPlaying || !isAvailable() || !YhplayerAudioModule) return;

		const sub = YhplayerAudioModule.addListener('AudioLevelsUpdated', (payload: unknown) => {
			const event = payload as { levels?: number[] };
			const levels = event?.levels;
			if (!Array.isArray(levels) || levels.length < BAR_COUNT) return;

			setUseNativeLevels(true);
			// Animate bars to real levels (0..1), map to scale 0.2..1.2 for visibility
			levels.slice(0, BAR_COUNT).forEach((level, i) => {
				const scale = 0.2 + Math.min(1, Math.max(0, level)) * 1.0;
				Animated.timing(animatedValues[i], {
					toValue: scale,
					duration: NATIVE_LEVEL_SMOOTH_MS,
					useNativeDriver: true,
				}).start();
			});
		});

		return () => {
			sub.remove();
			setUseNativeLevels(false);
		};
	}, [isPlaying]);

	// Fallback: random bar animation when not using native levels (Android or before first event)
	useEffect(() => {
		let prominentInterval: ReturnType<typeof setInterval>;

		if (isPlaying && !useNativeLevels) {
			prominentInterval = setInterval(() => {
				setProminentBar((prev) => (prev + 1) % BAR_COUNT);
				randomScales.forEach((_, i) => {
					randomScales[i] = 0.3 + Math.random() * 0.4;
				});
			}, 250);

			const animations = animatedValues.map((value) =>
				Animated.sequence([
					Animated.timing(value, {
						toValue: 1,
						duration: ANIMATION_DURATION * (0.2 + Math.random() * 0.3),
						useNativeDriver: true,
					}),
					Animated.timing(value, {
						toValue: 0,
						duration: ANIMATION_DURATION * (0.2 + Math.random() * 0.3),
						useNativeDriver: true,
					}),
				]),
			);

			const loop = Animated.loop(Animated.parallel(animations));
			fallbackLoopRef.current = loop;
			loop.start();

			return () => {
				loop.stop();
				fallbackLoopRef.current = null;
				clearInterval(prominentInterval);
			};
		}

		if (!isPlaying) {
			animatedValues.forEach((v) => v.setValue(0));
		} else if (useNativeLevels) {
			// Reset to 0.2 scale when switching to native so next event drives the bars
			animatedValues.forEach((v) => v.setValue(0.2));
		}
	}, [isPlaying, useNativeLevels]);

	if (!isPlaying) return null;

	// Native levels: animated values hold scale (0.2..1.2). Bar scaleY = value directly.
	if (useNativeLevels) {
		return (
			<Div style={{ ...styles.container, backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }}>
				{animatedValues.map((value, index) => (
					<Animated.View
						key={index}
						style={[
							styles.bar,
							{ backgroundColor: Colors.brandPrimary },
							{ transform: [{ scaleY: value }] },
						]}
					/>
				))}
			</Div>
		);
	}

	// Fallback: interpolate 0..1 to bar scale with prominent/random
	return (
		<Div style={{ ...styles.container, backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }}>
			{animatedValues.map((value, index) => (
				<Animated.View
					key={index}
					style={[
						styles.bar,
						{ backgroundColor: Colors.brandPrimary },
						{
							transform: [
								{
									scaleY: value.interpolate({
										inputRange: [0, 1],
										outputRange: [0.2, index === prominentBar ? 1.4 : randomScales[index]],
									}),
								},
							],
						},
					]}
				/>
			))}
		</Div>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 1.5,
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		borderRadius: 4,
	},
	bar: {
		width: 2.5,
		height: 16,
		borderRadius: 1,
	},
});
