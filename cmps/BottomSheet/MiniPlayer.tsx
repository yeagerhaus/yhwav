import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/cmps/ThemedText';
import { ThemedView } from '@/cmps/ThemedView';
import { useAudio } from '@/ctx/AudioContext';
import { usePlayback } from '@/ctx/PlaybackContext';
import { useSong } from '@/ctx/SongContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export function MiniPlayer({ onPress }: { onPress: () => void }) {
	const insets = useSafeAreaInsets();
	const colorScheme = useColorScheme();

	// Calculate bottom position considering tab bar height
	const bottomPosition = Platform.OS === 'ios' ? insets.bottom + 57 : 60;

	return (
		<Pressable onPress={onPress} style={[styles.container, { bottom: bottomPosition }]}>
			{Platform.OS === 'ios' ? (
				<BlurView
					tint={colorScheme === 'dark' ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
					intensity={80}
					style={[styles.content, styles.blurContainer]}
				>
					<MiniPlayerContent />
				</BlurView>
			) : (
				<ThemedView style={[styles.content, styles.androidContainer]}>
					<MiniPlayerContent />
				</ThemedView>
			)}
		</Pressable>
	);
}

// Extract the content into a separate component for reusability
const MiniPlayerContent = React.memo(() => {
	const colorScheme = useColorScheme();
	const { playNextSong, togglePlayPause } = useAudio();
	const { currentSong } = useSong();
	const { isPlaying } = usePlayback();

	if (!currentSong) return null;

	const artwork = React.useMemo(() => currentSong.artwork, [currentSong.artwork]);
	const title = React.useMemo(() => currentSong.title, [currentSong.title]);

	return (
		<ThemedView style={[styles.miniPlayerContent, { backgroundColor: colorScheme === 'light' ? '#ffffffa4' : 'transparent' }]}>
			<Image source={{ uri: artwork }} style={styles.artwork} />
			<ThemedView style={styles.textContainer}>
				<ThemedText style={styles.title}>{title}</ThemedText>
			</ThemedView>
			<ThemedView style={styles.controls}>
				<Pressable style={styles.controlButton} onPress={togglePlayPause}>
					<Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={colorScheme === 'light' ? '#000' : '#fff'} />
				</Pressable>
				<Pressable style={styles.controlButton} onPress={playNextSong}>
					<Ionicons name='play-forward' size={24} color={colorScheme === 'light' ? '#000' : '#fff'} />
				</Pressable>
			</ThemedView>
		</ThemedView>
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
		marginHorizontal: 10,
		borderRadius: 12,
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
	blurContainer: {
		// backgroundColor: '#00000000',
	},
	androidContainer: {},
	title: {
		fontWeight: '500',
	},
	artwork: {
		width: 40,
		height: 40,
		borderRadius: 8,
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
