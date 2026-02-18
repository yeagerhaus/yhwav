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

// Leave headroom so loud sections don't max out; keep visible variation between bars.
const LEVEL_GAIN = 0.38;
const LEVEL_CURVE = 0.5;
const BAR_SCALE_MIN = 0.2;
const BAR_SCALE_MAX = 1.2;

// Adaptive normalization: track a running "reference" level so quiet and loud masters
// both use the full visual range. Ref rises quickly on peaks, decays slowly so we
// don't over-boost after a single quiet moment.
const REF_DECAY = 0.996; // per update (~15 fps) — slow decay = remember track level
const REF_ATTACK = 1.15; // rise fast when we see a bigger peak
const REF_FLOOR = 0.04; // never divide by less (avoids blowing up in silence)

function levelToBarScale(level: number): number {
	const clamped = Math.min(1, Math.max(0, level));
	const curved = Math.pow(clamped, LEVEL_CURVE);
	const scaled = curved * LEVEL_GAIN;
	return BAR_SCALE_MIN + scaled * (BAR_SCALE_MAX - BAR_SCALE_MIN);
}

export function MusicVisualizer({ isPlaying }: Props) {
	const theme = useColorScheme();
	const animatedValues = useRef(new Array(BAR_COUNT).fill(0).map(() => new Animated.Value(0))).current;
	const [prominentBar, setProminentBar] = useState(0);
	const randomScales = useRef(new Array(BAR_COUNT).fill(0).map(() => 0.3 + Math.random() * 0.4)).current;
	const [useNativeLevels, setUseNativeLevels] = useState(false);
	const fallbackLoopRef = useRef<Animated.CompositeAnimation | null>(null);
	// Running reference level for adaptive normalization (avoids re-renders)
	const refLevelRef = useRef(0.2);

	// Subscribe to real audio levels on iOS when playing
	useEffect(() => {
		if (!isPlaying || !isAvailable() || !YhplayerAudioModule) return;

		// Reset reference when starting so each track can adapt
		refLevelRef.current = 0.2;

		const sub = YhplayerAudioModule.addListener('AudioLevelsUpdated', (payload: unknown) => {
			const event = payload as { levels?: number[] };
			const levels = event?.levels;
			if (!Array.isArray(levels) || levels.length < BAR_COUNT) return;

			setUseNativeLevels(true);

			const slice = levels.slice(0, BAR_COUNT);
			const peak = Math.max(...slice);
			let ref = refLevelRef.current;
			ref = Math.max(ref * REF_DECAY, peak * REF_ATTACK);
			ref = Math.max(ref, REF_FLOOR);
			refLevelRef.current = ref;

			const normalized = slice.map((l) => Math.min(1, l / ref));

			normalized.forEach((level, i) => {
				const scale = levelToBarScale(level);
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
			// Reset to min scale when switching to native so next event drives the bars
			animatedValues.forEach((v) => v.setValue(BAR_SCALE_MIN));
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
