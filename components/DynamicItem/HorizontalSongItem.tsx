import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { useAudioStore } from '@/hooks/useAudioStore';
import type { Song } from '@/types/song';

interface HorizontalSongItemProps {
	item: Song;
	queue?: Song[];
	size?: number;
}

const DEFAULT_SIZE = 150;

const HorizontalSongItem = React.memo(
	({ item, queue, size }: HorizontalSongItemProps) => {
		const playSound = useAudioStore((state) => state.playSound);
		const s = size ?? DEFAULT_SIZE;

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

HorizontalSongItem.displayName = 'HorizontalSongItem';

export default HorizontalSongItem;

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
	},
	artwork: {
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
