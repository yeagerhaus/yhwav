import React from 'react';
import { Pressable, StyleSheet, View as ThemedView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PlaybackControlsProps {
	isPlaying: boolean;
	onTogglePlayPause: () => void;
	onPlayPrevious: () => void;
	onPlayNext: () => void;
}

export const PlaybackControls = React.memo(({ 
	isPlaying, 
	onTogglePlayPause, 
	onPlayPrevious, 
	onPlayNext 
}: PlaybackControlsProps) => {
	return (
		<ThemedView style={styles.buttonContainer}>
			<Pressable style={styles.button} onPress={onPlayPrevious}>
				<Ionicons name='play-skip-back' size={35} color='#fff' />
			</Pressable>
			<Pressable style={[styles.button, styles.playButton]} onPress={onTogglePlayPause}>
				<Ionicons name={isPlaying ? 'pause' : 'play'} size={45} color='#fff' />
			</Pressable>
			<Pressable style={styles.button} onPress={onPlayNext}>
				<Ionicons name='play-skip-forward' size={35} color='#fff' />
			</Pressable>
		</ThemedView>
	);
});

const styles = StyleSheet.create({
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: 50,
		backgroundColor: 'transparent',
		marginTop: 10,
	},
	button: {
		padding: 10,
	},
	playButton: {
		transform: [{ scale: 1.2 }],
	},
});
