import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { isAvailable, YhwavAudioModule } from '@/modules/yhwav-audio';
import { Div } from './Div';

interface Props {
	isPlaying: boolean;
}

const BAR_COUNT = 3;
const BAR_HEIGHT = 13;
const BAR_WIDTH = 2.5;
const BAR_GAP = 2;
const NATIVE_SMOOTH_MS = 80;

// Scale range: SCALE_MIN is nearly invisible (resting), SCALE_MAX is full height
const SCALE_MIN = 0.06;
const SCALE_MAX = 1.0;
const LEVEL_CURVE = 0.55; // square-ish root for perceptual feel

// Per-bar fallback timings so bars go out of phase naturally
const BAR_DURATIONS = [420, 310, 530];
const BAR_DELAYS = [0, 130, 65];
// Fixed per-bar target heights (fraction of SCALE_MAX) for consistent but varied look
const BAR_FALLBACK_TARGETS = [0.85, 0.6, 0.95];

// Adaptive normalization: ref rises fast on peaks, decays slowly
const REF_DECAY = 0.996;
const REF_ATTACK = 1.15;
const REF_FLOOR = 0.04;

function levelToScale(level: number): number {
	const clamped = Math.min(1, Math.max(0, level));
	const curved = clamped ** LEVEL_CURVE;
	return SCALE_MIN + curved * (SCALE_MAX - SCALE_MIN);
}

export function MusicVisualizer({ isPlaying }: Props) {
	const colors = useColors();
	// animatedValues always hold the final scaleY in [SCALE_MIN, SCALE_MAX]
	const animatedValues = useRef(new Array(BAR_COUNT).fill(0).map(() => new Animated.Value(SCALE_MIN))).current;
	const [useNativeLevels, setUseNativeLevels] = useState(false);
	const refLevelRef = useRef(0.2);
	const loopsRef = useRef<Animated.CompositeAnimation[]>([]);
	const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// Bottom-anchor transform: when scaleY = s, translateY by +height/2*(1-s) to keep bottom edge fixed
	const translateYRange = [(BAR_HEIGHT / 2) * (1 - SCALE_MIN), (BAR_HEIGHT / 2) * (1 - SCALE_MAX)];

	// Native audio levels on iOS
	useEffect(() => {
		if (!isPlaying || !isAvailable() || !YhwavAudioModule) return;

		refLevelRef.current = 0.2;

		const sub = YhwavAudioModule.addListener('AudioLevelsUpdated', (payload: unknown) => {
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
				Animated.timing(animatedValues[i], {
					toValue: levelToScale(level),
					duration: NATIVE_SMOOTH_MS,
					useNativeDriver: true,
				}).start();
			});
		});

		return () => {
			sub.remove();
			setUseNativeLevels(false);
		};
	}, [isPlaying]);

	// Fallback: organic staggered loops when native levels aren't available
	useEffect(() => {
		const stopAll = () => {
			loopsRef.current.forEach((l) => l.stop());
			loopsRef.current = [];
			timeoutsRef.current.forEach(clearTimeout);
			timeoutsRef.current = [];
		};

		if (!isPlaying) {
			stopAll();
			animatedValues.forEach((v) => v.setValue(SCALE_MIN));
			return;
		}

		if (useNativeLevels) {
			stopAll();
			return;
		}

		stopAll();

		loopsRef.current = animatedValues.map((value, i) => {
			const duration = BAR_DURATIONS[i];
			const target = SCALE_MIN + BAR_FALLBACK_TARGETS[i] * (SCALE_MAX - SCALE_MIN);

			const loop = Animated.loop(
				Animated.sequence([
					Animated.timing(value, {
						toValue: target,
						duration: duration * 0.55,
						useNativeDriver: true,
					}),
					Animated.timing(value, {
						toValue: SCALE_MIN,
						duration: duration * 0.45,
						useNativeDriver: true,
					}),
				]),
			);

			const t = setTimeout(() => loop.start(), BAR_DELAYS[i]);
			timeoutsRef.current.push(t);
			return loop;
		});

		return stopAll;
	}, [isPlaying, useNativeLevels]);

	if (!isPlaying) return null;

	return (
		<Div style={styles.container} transparent>
			{animatedValues.map((value, index) => (
				<Animated.View
					key={index}
					style={[
						styles.bar,
						{ backgroundColor: colors.brand },
						{
							transform: [
								{
									translateY: value.interpolate({
										inputRange: [SCALE_MIN, SCALE_MAX],
										outputRange: translateYRange,
									}),
								},
								{ scaleY: value },
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
		gap: BAR_GAP,
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	bar: {
		width: BAR_WIDTH,
		height: BAR_HEIGHT,
		borderRadius: 1.5,
	},
});
