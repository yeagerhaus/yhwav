import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable, StyleSheet, View as ThemedView } from 'react-native';
import { useAudio } from '@/ctx/AudioContext';
import { usePlayback } from '@/ctx/PlaybackContext';
import { Div } from '../Div';

export const PlaybackControls = React.memo(() => {
	const { togglePlayPause, playNextSong, playPreviousSong } = useAudio();
	const { isPlaying } = usePlayback();

	return (
		<Div style={styles.buttonContainer}>
			<Pressable style={styles.button} onPress={playPreviousSong}>
				<SymbolView name='backward.fill' type='hierarchical' size={35} />
			</Pressable>
			<Pressable style={[styles.button, styles.playButton]} onPress={togglePlayPause}>
				<SymbolView name={isPlaying ? 'pause.fill' : 'play.fill'} type='hierarchical' size={40} />
			</Pressable>
			<Pressable style={styles.button} onPress={playNextSong}>
				<SymbolView name='forward.fill' type='hierarchical' size={35} />
			</Pressable>
		</Div>
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
