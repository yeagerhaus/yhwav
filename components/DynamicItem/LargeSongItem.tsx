import React, { useCallback } from 'react';
import { Dimensions, Image, Pressable, StyleSheet } from 'react-native';
import { useAudioStore } from '@/hooks/useAudioStore';
import { Text } from '../Text';
import type { Song } from '@/types/song';

const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 2 - 24;
interface HorizontalSongItemProps {
	item: Song;
	queue?: Song[];
	size?: number;
}

const LargeSongItem = React.memo(
	({ item, queue, size }: HorizontalSongItemProps) => {
		const playSound = useAudioStore((state) => state.playSound);
		const s = size ?? itemSize;

		const onPress = useCallback(() => {
			playSound(item, queue);
		}, [playSound, item, queue]);

		return (
			<Pressable style={[styles.container, { width: s }]} onPress={onPress}>
				<Image source={{ uri: item.artworkUrl }} style={[styles.artwork, { width: s, height: s }]} />
				<Text style={[styles.title, { maxWidth: s }]} numberOfLines={1}>
					{item.title}
				</Text>
				<Text style={[styles.artist, { maxWidth: s }]} numberOfLines={1}>
					{item.artist}
				</Text>
			</Pressable>
		);
	},
	(prev, next) => prev.item.id === next.item.id && prev.size === next.size && prev.queue?.length === next.queue?.length,
);

LargeSongItem.displayName = 'LargeSongItem';

export default LargeSongItem;

const styles = StyleSheet.create({
	container: {
		width: itemSize,
		alignItems: 'center',
	},
	artwork: {
		width: itemSize,
		height: itemSize,
		borderRadius: 8,
		marginBottom: 8,
		backgroundColor: '#eee',
	},
	title: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
	artist: {
		color: '#666',
		fontSize: 14,
		textAlign: 'center',
	},
});
