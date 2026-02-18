import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface SkeletonCardProps {
	size?: number;
}

export function SkeletonCard({ size = 175 }: SkeletonCardProps) {
	const translateX = useSharedValue(-size);
	const colorScheme = useColorScheme();
	const isDark = colorScheme === 'dark';

	const baseColor = isDark ? '#1a1a1a' : '#e8e8e8';
	const shimmerColors = isDark
		? (['#1a1a1a', '#2a2a2a', '#1a1a1a'] as const)
		: (['#e8e8e8', '#f5f5f5', '#e8e8e8'] as const);

	useEffect(() => {
		translateX.value = withRepeat(withTiming(size, { duration: 1200 }), -1, false);
	}, [size, translateX]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.value }],
	}));

	return (
		<View style={[styles.card, { width: size, height: size, backgroundColor: baseColor }]}>
			<AnimatedLinearGradient
				colors={shimmerColors}
				start={{ x: 0, y: 0.5 }}
				end={{ x: 1, y: 0.5 }}
				style={[styles.shimmer, { width: size }, animatedStyle]}
			/>
			<View style={[styles.textLine, { backgroundColor: baseColor, width: size * 0.7 }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: 8,
		overflow: 'hidden',
	},
	shimmer: {
		...StyleSheet.absoluteFillObject,
		height: '100%',
	},
	textLine: {
		position: 'absolute',
		bottom: -24,
		height: 12,
		borderRadius: 4,
	},
});
