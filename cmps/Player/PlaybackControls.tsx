import React from 'react';
import { Pressable, StyleSheet, View as ThemedView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudio } from '@/ctx/AudioContext';
import { usePlayback } from '@/ctx/PlaybackContext';

export const PlaybackControls = React.memo(() => {
	const { togglePlayPause, playNextSong, playPreviousSong } = useAudio();
	const { isPlaying } = usePlayback();

	console.log('🎵 PlaybackControls render - isPlaying:', isPlaying);

	return (
		<ThemedView style={styles.buttonContainer}>
			<Pressable style={styles.button} onPress={playPreviousSong}>
				<Ionicons name='play-skip-back' size={35} color='#fff' />
			</Pressable>
			<Pressable style={[styles.button, styles.playButton]} onPress={togglePlayPause}>
				<Ionicons name={isPlaying ? 'pause' : 'play'} size={45} color='#fff' />
			</Pressable>
			<Pressable style={styles.button} onPress={playNextSong}>
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
