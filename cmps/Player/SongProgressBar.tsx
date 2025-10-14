import { useCallback } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	configureReanimatedLogger,
	ReanimatedLogLevel,
	runOnJS,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
} from 'react-native-reanimated';
import { useAudioStore } from '@/hooks/useAudioStore';

configureReanimatedLogger({
	level: ReanimatedLogLevel.warn,
	strict: false,
});

export function SongProgressBar() {
	const position = useAudioStore((state) => state.position);
	const duration = useAudioStore((state) => state.duration);
	const seekTo = useAudioStore((state) => state.seekTo);

	const containerWidth = useSharedValue(0);
	const containerX = useSharedValue(0);
	const isScrubbing = useSharedValue(false);
	const scrubbingProgress = useSharedValue(0);

	const progress = useDerivedValue(() => {
		if (isScrubbing.value) {
			return scrubbingProgress.value;
		}
		if (duration === 0) return 0;
		return (position / duration) * 100;
	}, [position, duration]);

	const handleSeek = useCallback(
		(newPosition: number) => {
			seekTo(newPosition);
		},
		[seekTo],
	);

	const panGesture = Gesture.Pan()
		.onStart((event) => {
			isScrubbing.value = true;
			// Calculate position relative to container
			const relativeX = event.absoluteX - containerX.value;
			const progressPercent = (relativeX / containerWidth.value) * 100;
			scrubbingProgress.value = Math.max(0, Math.min(100, progressPercent));
		})
		.onUpdate((event) => {
			// Calculate position relative to container
			const relativeX = event.absoluteX - containerX.value;
			const progressPercent = (relativeX / containerWidth.value) * 100;
			scrubbingProgress.value = Math.max(0, Math.min(100, progressPercent));
		})
		.onEnd(() => {
			const newPosition = (scrubbingProgress.value / 100) * duration;
			runOnJS(handleSeek)(newPosition);
			isScrubbing.value = false;
		});

	const tapGesture = Gesture.Tap().onStart((event) => {
		// Calculate position relative to container
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

	const thumbStyle = useAnimatedStyle(() => {
		return {
			opacity: isScrubbing.value ? 1 : 0,
			transform: [{ scale: isScrubbing.value ? 1 : 0.5 }],
		};
	});

	return (
		<View style={{ width: '100%', marginTop: 15, marginBottom: 10 }}>
			<GestureDetector gesture={composedGesture}>
				<Animated.View
					onLayout={(event) => {
						const layout = event.nativeEvent.layout;
						containerWidth.value = layout.width;
						// Measure absolute position
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
					<View
						style={{
							width: '100%',
							height: 5,
							borderRadius: 30,
							backgroundColor: 'rgba(255, 255, 255, 0.3)',
							justifyContent: 'center',
						}}
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
					</View>
				</Animated.View>
			</GestureDetector>
		</View>
	);
}
