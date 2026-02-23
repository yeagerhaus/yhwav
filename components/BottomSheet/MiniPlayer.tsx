import { SymbolView } from 'expo-symbols';
import React, { useCallback } from 'react';
import { Image, Platform, Pressable, StyleSheet, useColorScheme } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Div } from '@/components/Div';
import { Text } from '@/components/Text';
import { useAudioStore } from '@/hooks/useAudioStore';
import { useColors } from '@/hooks/useColors';

const PRESS_DOWN = { duration: 80 } as const;
const PRESS_UP = { duration: 150 } as const;

export function MiniPlayer({ onPress }: { onPress: () => void }) {
	const insets = useSafeAreaInsets();
	const pressScale = useSharedValue(1);

	const bottomPosition = Platform.OS === 'ios' ? insets.bottom + 57 : 60;

	const animatedStyle = useAnimatedStyle(() => ({
		flex: 1,
		transform: [{ scale: pressScale.value }],
	}));

	const handlePressIn = useCallback(() => {
		pressScale.value = withTiming(0.97, PRESS_DOWN);
	}, [pressScale]);

	const handlePressOut = useCallback(() => {
		pressScale.value = withTiming(1, PRESS_UP);
	}, [pressScale]);

	return (
		<Pressable
			onPress={onPress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={[styles.container, { bottom: bottomPosition }]}
		>
			<Animated.View style={animatedStyle}>
				<Div useGlass style={styles.content}>
					<MiniPlayerContent />
				</Div>
			</Animated.View>
		</Pressable>
	);
}

// Extract the content into a separate component for reusability
const MiniPlayerContent = React.memo(() => {
	const colorScheme = useColorScheme();
	const colors = useColors();
	const currentSong = useAudioStore((state) => state.currentSong);
	const isPlaying = useAudioStore((state) => state.isPlaying);
	const togglePlayPause = useAudioStore((state) => state.togglePlayPause);
	const skipToNext = useAudioStore((state) => state.skipToNext);
	const skipBackward15 = useAudioStore((state) => state.skipBackward15);
	const skipForward15 = useAudioStore((state) => state.skipForward15);

	const isPodcast = currentSong?.source === 'podcast';
	const artwork = React.useMemo(() => currentSong?.artworkUrl || currentSong?.artwork, [currentSong?.artworkUrl, currentSong?.artwork]);
	const title = React.useMemo(() => currentSong?.title, [currentSong?.title]);

	if (!currentSong) return null;

	return (
		<Div style={[styles.miniPlayerContent, { backgroundColor: colorScheme === 'light' ? '#ffffffa4' : 'transparent' }]}>
			<Image source={{ uri: artwork }} style={styles.artwork} />
			<Div transparent style={styles.textContainer}>
				<Text style={styles.title} numberOfLines={1} ellipsizeMode='tail'>
					{title}
				</Text>
			</Div>
			<Div transparent style={styles.controls}>
				{isPodcast ? (
					<>
						<Pressable style={styles.controlButton} onPress={skipBackward15}>
							<SymbolView name='gobackward.15' type='hierarchical' size={22} tintColor={colors.brand} />
						</Pressable>
						<Pressable style={styles.controlButton} onPress={togglePlayPause}>
							<SymbolView
								name={isPlaying ? 'pause.fill' : 'play.fill'}
								type='hierarchical'
								size={20}
								tintColor={colors.brand}
							/>
						</Pressable>
						<Pressable style={styles.controlButton} onPress={skipForward15}>
							<SymbolView name='goforward.15' type='hierarchical' size={22} tintColor={colors.brand} />
						</Pressable>
					</>
				) : (
					<>
						<Pressable style={styles.controlButton} onPress={togglePlayPause}>
							<SymbolView
								name={isPlaying ? 'pause.fill' : 'play.fill'}
								type='hierarchical'
								size={20}
								tintColor={colors.brand}
							/>
						</Pressable>
						<Pressable style={styles.controlButton} onPress={skipToNext}>
							<SymbolView name='forward.fill' type='hierarchical' size={24} tintColor={colors.brand} />
						</Pressable>
					</>
				)}
			</Div>
		</Div>
	);
});

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		left: 0,
		right: 0,
		height: 56,
		zIndex: 1000,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 5,
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
		// height: 40,
		marginHorizontal: 20,
		borderRadius: 100,
		overflow: 'hidden',
		zIndex: 1000,
		flex: 1,
		paddingVertical: 0,
	},
	miniPlayerContent: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		height: '100%',
		paddingHorizontal: 10,
		// backgroundColor: '#ffffffa4',
	},
	androidContainer: {},
	title: {
		fontWeight: '500',
	},
	artwork: {
		marginLeft: 8,
		width: 40,
		height: 40,
		borderRadius: 4,
	},
	textContainer: {
		flex: 1,
		marginLeft: 12,
		backgroundColor: 'transparent',
	},
	controls: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginRight: 4,
		backgroundColor: 'transparent',
	},
	controlButton: {
		padding: 8,
	},
});
