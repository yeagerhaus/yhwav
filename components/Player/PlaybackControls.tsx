import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAudioStore } from '@/hooks/useAudioStore';
import { Div } from '../Div';

export const PlaybackControls = React.memo(() => {
	const currentSong = useAudioStore((state) => state.currentSong);
	const isPlaying = useAudioStore((state) => state.isPlaying);
	const togglePlayPause = useAudioStore((state) => state.togglePlayPause);
	const skipToNext = useAudioStore((state) => state.skipToNext);
	const skipToPrevious = useAudioStore((state) => state.skipToPrevious);
	const skipBackward15 = useAudioStore((state) => state.skipBackward15);
	const skipForward15 = useAudioStore((state) => state.skipForward15);

	const isPodcast = currentSong?.source === 'podcast';

	return (
		<Div transparent style={styles.buttonContainer}>
			<Pressable
				style={styles.button}
				onPress={isPodcast ? skipBackward15 : skipToPrevious}
			>
				<SymbolView
					name={isPodcast ? 'gobackward.15' : 'backward.fill'}
					type='hierarchical'
					size={35}
					tintColor='#fff'
				/>
			</Pressable>
			<Pressable style={[styles.button, styles.playButton]} onPress={togglePlayPause}>
				<SymbolView name={isPlaying ? 'pause.fill' : 'play.fill'} type='hierarchical' size={40} tintColor='#fff' />
			</Pressable>
			<Pressable
				style={styles.button}
				onPress={isPodcast ? skipForward15 : skipToNext}
			>
				<SymbolView
					name={isPodcast ? 'goforward.15' : 'forward.fill'}
					type='hierarchical'
					size={35}
					tintColor='#fff'
				/>
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
