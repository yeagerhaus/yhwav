import { View } from "react-native";
import Animated, { configureReanimatedLogger, ReanimatedLogLevel, useAnimatedStyle, useDerivedValue } from "react-native-reanimated";

export function SongProgressBar({position, duration}: {position: number, duration: number}) {
	const progress = useDerivedValue(() => {
		if (duration === 0) return 0;
		return (position / duration) * 100;
	}, [position, duration]);

	configureReanimatedLogger({
		level: ReanimatedLogLevel.warn,
		strict: false,
	  });

	const animatedStyle = useAnimatedStyle(() => {
		return {
			width: `${progress.value}%`,
		};
	});

	return (
		<View style={{ width: '100%', marginTop: 15, marginBottom: 10, height: 5, borderRadius: 30, backgroundColor: 'rgba(255, 255, 255, 0.3)' }}>
			<Animated.View style={[animatedStyle, { height: '100%', borderRadius: 30, backgroundColor: '#fff' }]} />
		</View>
	);
}
