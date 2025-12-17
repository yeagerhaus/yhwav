import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ExpandedPlayer } from '@/components/BottomSheet/ExpandedPlayer';
import { Div } from '@/components/Div';
import { useRootScale } from '@/ctx/RootScaleContext';

// Constants moved outside component to prevent recalculation
const SCALE_FACTOR = 0.83;
const DRAG_THRESHOLD = Math.min(Dimensions.get('window').height * 0.2, 150);
const HORIZONTAL_DRAG_THRESHOLD = Math.min(Dimensions.get('window').width * 0.51, 80);
const DIRECTION_LOCK_ANGLE = 45; // Angle in degrees to determine horizontal vs vertical movement
const ENABLE_HORIZONTAL_DRAG_CLOSE = false;

// Animation configs moved outside component
const SPRING_CONFIG = {
	damping: 15,
	stiffness: 150,
} as const;

const TIMING_CONFIG = {
	duration: 300,
} as const;

function MusicScreen() {
	// Don't use useAudio() here as it causes re-renders on progress updates
	const router = useRouter();
	const { setScale } = useRootScale();

	// Shared values - grouped for better organization
	const translateY = useSharedValue(0);
	const translateX = useSharedValue(0);
	const scrollOffset = useSharedValue(0);
	const statusBarStyle = useSharedValue<'light' | 'dark'>('light');

	// Gesture state
	const isDragging = useSharedValue(false);
	const isScrolling = useSharedValue(false);
	const isHorizontalGesture = useSharedValue(false);
	const initialGestureX = useSharedValue(0);
	const initialGestureY = useSharedValue(0);

	// Component state
	const isClosing = useRef(false);

	// Note: numericId calculation removed as it was unused

	const handleHapticFeedback = useCallback(() => {
		try {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		} catch (error) {
			console.log('Haptics not available:', error);
		}
	}, []);

	const goBack = useCallback(() => {
		if (!isClosing.current) {
			isClosing.current = true;
			handleHapticFeedback();
			requestAnimationFrame(() => {
				router.back();
			});
		}
	}, [router, handleHapticFeedback]);

	const handleScale = useCallback(
		(newScale: number) => {
			try {
				setScale(newScale);
			} catch (error) {
				console.log('Scale error:', error);
			}
		},
		[setScale],
	);

	// Moved outside component to prevent recreation on every render
	const calculateGestureAngle = useCallback((x: number, y: number) => {
		'worklet';
		const angle = Math.abs(Math.atan2(y, x) * (180 / Math.PI));
		return angle;
	}, []);

	const panGesture = useMemo(
		() =>
			Gesture.Pan()
				.onStart((event) => {
					'worklet';
					initialGestureX.value = event.x;
					initialGestureY.value = event.y;
					isHorizontalGesture.value = false;

					if (scrollOffset.value <= 0) {
						isDragging.value = true;
						translateY.value = 0;
					}
				})
				.onUpdate((event) => {
					'worklet';
					const dx = event.translationX;
					const dy = event.translationY;

					// Only check for horizontal gesture if enabled
					if (ENABLE_HORIZONTAL_DRAG_CLOSE && !isHorizontalGesture.value && !isScrolling.value) {
						if (Math.abs(dx) > 10) {
							const angle = calculateGestureAngle(dx, dy);
							if (angle < DIRECTION_LOCK_ANGLE) {
								isHorizontalGesture.value = true;
							}
						}
					}

					// Handle horizontal gesture only if enabled
					if (ENABLE_HORIZONTAL_DRAG_CLOSE && isHorizontalGesture.value) {
						translateX.value = dx;
						translateY.value = dy;

						const totalDistance = Math.sqrt(dx * dx + dy * dy);
						const progress = Math.min(totalDistance / 300, 1);
						const newScale = SCALE_FACTOR + progress * (1 - SCALE_FACTOR);

						runOnJS(handleScale)(newScale);
						statusBarStyle.value = progress > 0.2 ? 'dark' : 'light';
					}
					// Handle vertical-only gesture
					else if (scrollOffset.value <= 0 && isDragging.value) {
						translateY.value = Math.max(0, dy);
						const progress = Math.min(dy / 600, 1);
						const newScale = SCALE_FACTOR + progress * (1 - SCALE_FACTOR);

						runOnJS(handleScale)(newScale);
						statusBarStyle.value = progress > 0.5 ? 'dark' : 'light';
					}
				})
				.onEnd((event) => {
					'worklet';
					isDragging.value = false;

					// Handle horizontal gesture end only if enabled
					if (ENABLE_HORIZONTAL_DRAG_CLOSE && isHorizontalGesture.value) {
						const dx = event.translationX;
						const dy = event.translationY;
						const totalDistance = Math.sqrt(dx * dx + dy * dy);
						const shouldClose = totalDistance > HORIZONTAL_DRAG_THRESHOLD;

						if (shouldClose) {
							// Calculate the exit direction based on the gesture
							const exitX = dx * 2;
							const exitY = dy * 2;

							translateX.value = withTiming(exitX, TIMING_CONFIG);
							translateY.value = withTiming(exitY, TIMING_CONFIG);

							runOnJS(handleScale)(1);
							runOnJS(handleHapticFeedback)();
							runOnJS(goBack)();
						} else {
							// Spring back to original position
							translateX.value = withSpring(0, SPRING_CONFIG);
							translateY.value = withSpring(0, SPRING_CONFIG);
							runOnJS(handleScale)(SCALE_FACTOR);
						}
					}
					// Handle vertical gesture end
					else if (scrollOffset.value <= 0) {
						const shouldClose = event.translationY > DRAG_THRESHOLD;

						if (shouldClose) {
							translateY.value = withTiming(event.translationY + 100, TIMING_CONFIG);
							runOnJS(handleScale)(1);
							runOnJS(handleHapticFeedback)();
							runOnJS(goBack)();
						} else {
							translateY.value = withSpring(0, SPRING_CONFIG);
							runOnJS(handleScale)(SCALE_FACTOR);
						}
					}
				})
				.onFinalize(() => {
					'worklet';
					isDragging.value = false;
					isHorizontalGesture.value = false;
				}),
		[calculateGestureAngle, handleScale, handleHapticFeedback, goBack],
	);

	const scrollGesture = useMemo(
		() =>
			Gesture.Native()
				.onBegin(() => {
					'worklet';
					isScrolling.value = true;
					if (!isDragging.value) {
						translateY.value = 0;
					}
				})
				.onEnd(() => {
					'worklet';
					isScrolling.value = false;
				}),
		[],
	);

	const composedGestures = useMemo(() => Gesture.Simultaneous(panGesture, scrollGesture), [panGesture, scrollGesture]);

	// Optimized scroll handler
	const handleScroll = useCallback((event: any) => {
		'worklet';
		scrollOffset.value = event.nativeEvent.contentOffset.y;
		if (!isDragging.value && translateY.value !== 0) {
			translateY.value = 0;
		}
	}, []);

	const ScrollComponent = useMemo(
		() => (props: any) => (
			<GestureDetector gesture={composedGestures}>
				<Animated.ScrollView {...props} onScroll={handleScroll} scrollEventThrottle={16} bounces={false} />
			</GestureDetector>
		),
		[composedGestures, handleScroll],
	);

	const animatedStyle = useAnimatedStyle(
		() => ({
			transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
			opacity: 1, // Removed unnecessary withSpring for better performance
		}),
		[],
	);

	useEffect(() => {
		const timeout = setTimeout(() => {
			try {
				setScale(SCALE_FACTOR);
			} catch (error) {
				console.log('Initial scale error:', error);
			}
		}, 0);

		return () => {
			clearTimeout(timeout);
			try {
				setScale(1);
			} catch (error) {
				console.log('Cleanup scale error:', error);
			}
		};
	}, [setScale]);

	return (
		<Div style={{ flex: 1, backgroundColor: 'transparent' }}>
			<StatusBar animated={true} style={statusBarStyle.value} />
			<Animated.View style={[{ flex: 1, backgroundColor: 'transparent' }, animatedStyle]}>
				<ExpandedPlayer scrollComponent={ScrollComponent} />
			</Animated.View>
		</Div>
	);
}

// Wrap with React.memo for better performance
export default React.memo(MusicScreen);
