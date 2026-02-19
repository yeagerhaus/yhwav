import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	configureReanimatedLogger,
	Easing,
	ReanimatedLogLevel,
	runOnJS,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated';
import { useAudioStore } from '@/hooks/useAudioStore';
import { Div } from '../Div';

configureReanimatedLogger({
	level: ReanimatedLogLevel.warn,
	strict: false,
});

const PROGRESS_UPDATE_INTERVAL_MS = 500;

export function SongProgressBar() {
	const position = useAudioStore((state) => state.position);
	const duration = useAudioStore((state) => state.duration);
	const isPlaying = useAudioStore((state) => state.isPlaying);
	const playbackRate = useAudioStore((state) => state.playbackRate);
	const seekTo = useAudioStore((state) => state.seekTo);

	const containerWidth = useSharedValue(0);
	const containerX = useSharedValue(0);
	const isScrubbing = useSharedValue(false);
	const scrubbingProgress = useSharedValue(0);
	const thumbOpacity = useSharedValue(0);
	const thumbScale = useSharedValue(0.3);
	const trackHeight = useSharedValue(5);

	// Animated progress that interpolates smoothly between native updates
	const animatedProgress = useSharedValue(0);

	// On each native position update, animate smoothly to the next expected position
	useEffect(() => {
		if (duration === 0) {
			animatedProgress.value = 0;
			return;
		}
		const currentPercent = Math.min(100, Math.max(0, (position / duration) * 100));
		if (isPlaying) {
			// Animate from current position to where we expect to be at the next update
			const nextPercent = Math.min(100, currentPercent + ((playbackRate * PROGRESS_UPDATE_INTERVAL_MS) / 1000 / duration) * 100);
			animatedProgress.value = currentPercent;
			animatedProgress.value = withTiming(nextPercent, {
				duration: PROGRESS_UPDATE_INTERVAL_MS,
				easing: Easing.linear,
			});
		} else {
			// Paused — snap to exact position
			animatedProgress.value = currentPercent;
		}
	}, [position, duration, isPlaying, playbackRate]);

	const progress = useDerivedValue(() => {
		if (isScrubbing.value) {
			return scrubbingProgress.value;
		}
		return animatedProgress.value;
	});

	const handleSeek = useCallback(
		(newPosition: number) => {
			seekTo(newPosition);
		},
		[seekTo],
	);

	const fireHaptic = useCallback(() => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
	}, []);

	const panGesture = Gesture.Pan()
		.onStart((event) => {
			isScrubbing.value = true;
			thumbOpacity.value = withTiming(1, { duration: 150 });
			thumbScale.value = withTiming(1, { duration: 200 });
			trackHeight.value = withTiming(8, { duration: 200 });
			runOnJS(fireHaptic)();
			const relativeX = event.absoluteX - containerX.value;
			const progressPercent = (relativeX / containerWidth.value) * 100;
			scrubbingProgress.value = Math.max(0, Math.min(100, progressPercent));
		})
		.onUpdate((event) => {
			const relativeX = event.absoluteX - containerX.value;
			const progressPercent = (relativeX / containerWidth.value) * 100;
			scrubbingProgress.value = Math.max(0, Math.min(100, progressPercent));
		})
		.onEnd(() => {
			const newPosition = (scrubbingProgress.value / 100) * duration;
			runOnJS(handleSeek)(newPosition);
			isScrubbing.value = false;
			thumbOpacity.value = withTiming(0, { duration: 150 });
			thumbScale.value = withTiming(0.3, { duration: 200 });
			trackHeight.value = withTiming(5, { duration: 200 });
		});

	const tapGesture = Gesture.Tap().onStart((event) => {
		const relativeX = event.absoluteX - containerX.value;
		const progressPercent = (relativeX / containerWidth.value) * 100;
		const clampedProgress = Math.max(0, Math.min(100, progressPercent));
		const newPosition = (clampedProgress / 100) * duration;
		runOnJS(handleSeek)(newPosition);
	});

	const composedGesture = Gesture.Race(panGesture, tapGesture);

	const animatedStyle = useAnimatedStyle(() => {
		return {
			width: `${progress.value}%`,
		};
	});

	const thumbStyle = useAnimatedStyle(() => ({
		opacity: thumbOpacity.value,
		transform: [{ scale: thumbScale.value }],
	}));

	const trackHeightStyle = useAnimatedStyle(() => ({
		height: trackHeight.value,
	}));

	return (
		<Div transparent style={{ width: '100%', marginTop: 15, marginBottom: 10 }}>
			<GestureDetector gesture={composedGesture}>
				<Animated.View
					onLayout={(event) => {
						const layout = event.nativeEvent.layout;
						containerWidth.value = layout.width;
						event.target.measure((_x, _y, _width, _height, pageX) => {
							containerX.value = pageX;
						});
					}}
					style={{
						width: '100%',
						paddingVertical: 10,
						justifyContent: 'center',
					}}
				>
				<Animated.View
					style={[
						trackHeightStyle,
						{
							width: '100%',
							borderRadius: 30,
							backgroundColor: 'rgba(255, 255, 255, 0.3)',
							justifyContent: 'center',
						},
					]}
				>
						<Animated.View
							style={[animatedStyle, { height: '100%', borderRadius: 30, backgroundColor: '#fff', position: 'relative' }]}
						>
							<Animated.View
								style={[
									thumbStyle,
									{
										position: 'absolute',
										right: -8,
										top: '50%',
										marginTop: -8,
										width: 16,
										height: 16,
										borderRadius: 8,
										backgroundColor: '#fff',
										shadowColor: '#000',
										shadowOffset: { width: 0, height: 2 },
										shadowOpacity: 0.3,
										shadowRadius: 4,
										elevation: 4,
									},
								]}
							/>
					</Animated.View>
				</Animated.View>
				</Animated.View>
			</GestureDetector>
		</Div>
	);
}
