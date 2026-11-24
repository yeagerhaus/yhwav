import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
	cancelAnimation,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { isAvailable, YhwavAudioModule } from '@/modules/yhwav-audio';
import { Div } from './Div';

interface Props {
	isPlaying: boolean;
}

const BAR_COUNT = 5;
const BAR_HEIGHT = 14;
const BAR_WIDTH = 2.5;
const BAR_GAP = 1.5;
const NATIVE_SMOOTH_MS = 75;

const SCALE_MIN = 0.15;
const SCALE_MAX = 1.1;
const LEVEL_CURVE = 0.5;

// Per-bar fallback: varied speeds + staggered starts for organic out-of-phase feel
const BAR_DURATIONS = [480, 340, 580, 420, 640];
const BAR_DELAYS = [0, 90, 180, 45, 135];
const BAR_FALLBACK_TARGETS = [0.7, 0.95, 0.55, 1.0, 0.75];

// Adaptive normalization: ref rises fast on peaks, decays slowly
const REF_DECAY = 0.996;
const REF_ATTACK = 1.15;
const REF_FLOOR = 0.04;

function levelToScale(level: number): number {
	const clamped = Math.min(1, Math.max(0, level));
	const curved = clamped ** LEVEL_CURVE;
	return SCALE_MIN + curved * (SCALE_MAX - SCALE_MIN);
}

function Bar({ value, color }: { value: SharedValue<number>; color: string }) {
	const style = useAnimatedStyle(() => ({ transform: [{ scaleY: value.value }] }));
	return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

/**
 * Animated equalizer bars. Native audio levels drive Reanimated shared values on the UI thread; the
 * native level tap only runs while this listener exists (see OnStartObserving in the audio module).
 */
export function MusicVisualizer({ isPlaying }: Props) {
	const colors = useColors();
	const theme = useColorScheme();
	const s0 = useSharedValue(SCALE_MIN);
	const s1 = useSharedValue(SCALE_MIN);
	const s2 = useSharedValue(SCALE_MIN);
	const s3 = useSharedValue(SCALE_MIN);
	const s4 = useSharedValue(SCALE_MIN);
	const bars = [s0, s1, s2, s3, s4];
	const barsRef = useRef(bars);
	barsRef.current = bars;
	const [useNativeLevels, setUseNativeLevels] = useState(false);
	const receivedNativeRef = useRef(false);
	const refLevelRef = useRef(0.2);

	// Native audio levels on iOS
	useEffect(() => {
		if (!isPlaying || !isAvailable() || !YhwavAudioModule) return;

		refLevelRef.current = 0.2;
		receivedNativeRef.current = false;

		const sub = YhwavAudioModule.addListener('AudioLevelsUpdated', (payload: unknown) => {
			const levels = (payload as { levels?: number[] })?.levels;
			if (!Array.isArray(levels) || levels.length < BAR_COUNT) return;

			if (!receivedNativeRef.current) {
				receivedNativeRef.current = true;
				setUseNativeLevels(true);
			}

			let peak = 0;
			for (let i = 0; i < BAR_COUNT; i++) peak = Math.max(peak, levels[i]);
			let ref = refLevelRef.current;
			ref = Math.max(ref * REF_DECAY, peak * REF_ATTACK);
			ref = Math.max(ref, REF_FLOOR);
			refLevelRef.current = ref;

			const values = barsRef.current;
			for (let i = 0; i < BAR_COUNT; i++) {
				values[i].value = withTiming(levelToScale(Math.min(1, levels[i] / ref)), { duration: NATIVE_SMOOTH_MS });
			}
		});

		return () => {
			sub.remove();
			setUseNativeLevels(false);
		};
	}, [isPlaying]);

	// Fallback: organic staggered loops when native levels aren't available
	useEffect(() => {
		const values = barsRef.current;
		const stopAll = () => {
			for (const v of values) cancelAnimation(v);
		};

		if (!isPlaying) {
			stopAll();
			for (const v of values) v.value = SCALE_MIN;
			return;
		}
		if (useNativeLevels) {
			stopAll();
			return;
		}

		values.forEach((v, i) => {
			const target = SCALE_MIN + BAR_FALLBACK_TARGETS[i] * (SCALE_MAX - SCALE_MIN);
			v.value = withDelay(
				BAR_DELAYS[i],
				withRepeat(
					withSequence(
						withTiming(target, { duration: BAR_DURATIONS[i] * 0.55 }),
						withTiming(SCALE_MIN, { duration: BAR_DURATIONS[i] * 0.45 }),
					),
					-1,
				),
			);
		});

		return stopAll;
	}, [isPlaying, useNativeLevels]);

	if (!isPlaying) return null;

	const bgColor = theme === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

	return (
		<Div style={[styles.container, { backgroundColor: bgColor }]}>
			{bars.map((value, index) => (
				<Bar key={index} value={value} color={colors.brand} />
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
		borderRadius: 4,
	},
	bar: {
		width: BAR_WIDTH,
		height: BAR_HEIGHT,
		borderRadius: 1.5,
	},
});
