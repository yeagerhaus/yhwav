import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Div } from '@/components/Div';
import { Text } from '@/components/Text';
import { RepeatMode } from '@/lib/playerAdapter';
import { useAudioStore } from '@/hooks/useAudioStore';

const SPEED_OPTIONS = [0.5, 1, 1.25, 1.5, 2];

interface ExtraControlsProps {
	queueOpen?: boolean;
	onToggleQueue?: () => void;
}

export const ExtraControls = React.memo(({ queueOpen, onToggleQueue }: ExtraControlsProps) => {
	const currentSong = useAudioStore((state) => state.currentSong);
	const repeatMode = useAudioStore((state) => state.repeatMode);
	const isShuffled = useAudioStore((state) => state.isShuffled);
	const playbackRate = useAudioStore((state) => state.playbackRate);
	const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
	const toggleRepeat = useAudioStore((state) => state.toggleRepeat);
	const toggleShuffle = useAudioStore((state) => state.toggleShuffle);

	const isPodcast = currentSong?.source === 'podcast';

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

	const getQueueColor = () => {
		return queueOpen ? '#fff' : 'rgba(255, 255, 255, 0.5)';
	};

	if (isPodcast) {
		return (
			<Div transparent style={styles.extraControls}>
				<Div transparent style={styles.speedRow}>
					{SPEED_OPTIONS.map((rate) => (
						<Pressable
							key={rate}
							style={[styles.speedButton, playbackRate === rate && styles.speedButtonActive]}
							onPress={() => setPlaybackRate(rate)}
						>
							<Text style={styles.speedButtonText}>{rate}x</Text>
						</Pressable>
					))}
				</Div>
			</Div>
		);
	}

	return (
		<Div transparent style={styles.extraControls}>
			<Pressable style={styles.extraControlButton} onPress={toggleShuffle}>
				<SymbolView name='shuffle' size={30} tintColor={getShuffleColor()} />
			</Pressable>
			<Pressable style={styles.extraControlButton} onPress={onToggleQueue}>
				<SymbolView name='list.bullet' size={30} tintColor={getQueueColor()} />
			</Pressable>
			<Pressable style={styles.extraControlButton} onPress={toggleRepeat}>
				<SymbolView name={getRepeatIcon()} size={30} tintColor={getRepeatColor()} />
			</Pressable>
		</Div>
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
	speedRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		flexWrap: 'wrap',
	},
	speedButton: {
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: 20,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
	},
	speedButtonActive: {
		backgroundColor: 'rgba(255, 255, 255, 0.5)',
	},
	speedButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
	},
});
