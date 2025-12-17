import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAudioStore } from '@/hooks/useAudioStore';
import { Div } from '../Div';

export const PlaybackControls = React.memo(() => {
	const isPlaying = useAudioStore((state) => state.isPlaying);
	const togglePlayPause = useAudioStore((state) => state.togglePlayPause);
	const skipToNext = useAudioStore((state) => state.skipToNext);
	const skipToPrevious = useAudioStore((state) => state.skipToPrevious);

	return (
		<Div style={styles.buttonContainer}>
			<Pressable style={styles.button} onPress={skipToPrevious}>
				<SymbolView name='backward.fill' type='hierarchical' size={35} tintColor='#fff' />
			</Pressable>
			<Pressable style={[styles.button, styles.playButton]} onPress={togglePlayPause}>
				<SymbolView name={isPlaying ? 'pause.fill' : 'play.fill'} type='hierarchical' size={40} tintColor='#fff' />
			</Pressable>
			<Pressable style={styles.button} onPress={skipToNext}>
				<SymbolView name='forward.fill' type='hierarchical' size={35} tintColor='#fff' />
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
