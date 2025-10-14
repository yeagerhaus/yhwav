import { View } from 'react-native';
import Animated, { configureReanimatedLogger, ReanimatedLogLevel, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { useAudioStore } from '@/hooks/useAudioStore';

export function SongProgressBar() {
	const position = useAudioStore((state) => state.position);
	const duration = useAudioStore((state) => state.duration);

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
		<View
			style={{
				width: '100%',
				marginTop: 15,
				marginBottom: 10,
				height: 5,
				borderRadius: 30,
				backgroundColor: 'rgba(255, 255, 255, 0.3)',
			}}
		>
			<Animated.View style={[animatedStyle, { height: '100%', borderRadius: 30, backgroundColor: '#fff' }]} />
		</View>
	);
}
