import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable, StyleSheet, View as ThemedView } from 'react-native';
import { RepeatMode } from 'react-native-track-player';
import { useAudioStore } from '@/hooks/useAudioStore';

export const ExtraControls = React.memo(() => {
	const repeatMode = useAudioStore((state) => state.repeatMode);
	const isShuffled = useAudioStore((state) => state.isShuffled);
	const toggleRepeat = useAudioStore((state) => state.toggleRepeat);
	const toggleShuffle = useAudioStore((state) => state.toggleShuffle);

	const getRepeatIcon = () => {
		if (repeatMode === RepeatMode.Track) return 'repeat.1';
		return 'repeat';
	};

	const getRepeatColor = () => {
		if (repeatMode === RepeatMode.Off) return 'rgba(255, 255, 255, 0.5)';
		return '#fff';
	};

	const getShuffleColor = () => {
		return isShuffled ? '#fff' : 'rgba(255, 255, 255, 0.5)';
	};

	return (
		<ThemedView style={styles.extraControls}>
			<Pressable style={styles.extraControlButton} onPress={toggleShuffle}>
				<SymbolView name='shuffle' size={30} tintColor={getShuffleColor()} />
			</Pressable>
			{/* <Pressable style={styles.extraControlButton}>
				<ThemedView style={styles.extraControlIcons}>
					<Ionicons name='volume-off' size={26} color='#fff' marginRight={-6} />
					<Ionicons name='bluetooth' size={24} color='#fff' />
				</ThemedView>
			</Pressable> */}
			<Pressable style={styles.extraControlButton} onPress={toggleRepeat}>
				<SymbolView name={getRepeatIcon()} size={30} tintColor={getRepeatColor()} />
			</Pressable>
		</ThemedView>
	);
});

const styles = StyleSheet.create({
	extraControls: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		width: '100%',
		paddingHorizontal: 20,
		marginTop: 26,
		backgroundColor: 'transparent',
	},
	extraControlButton: {
		alignItems: 'center',
		opacity: 0.8,
		height: 60,
	},
	extraControlIcons: {
		flexDirection: 'row',
	},
});
