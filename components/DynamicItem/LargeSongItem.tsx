import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useAudioStore } from '@/hooks/useAudioStore';
import type { Song } from '@/types/song';
import { Text } from '../Text';

const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 2 - 24;
interface HorizontalSongItemProps {
	item: Song;
	queue?: Song[];
	size?: number;
	editorial?: boolean;
}

const LargeSongItem = React.memo(
	({ item, queue, size, editorial }: HorizontalSongItemProps) => {
		const playSound = useAudioStore((state) => state.playSound);
		const s = size ?? itemSize;

		const onPress = useCallback(() => {
			playSound(item, queue);
		}, [playSound, item, queue]);

		if (editorial) {
			return (
				<Pressable style={[styles.editorialContainer, { width: s, height: s }]} onPress={onPress}>
					<Image source={{ uri: item.artworkUrl }} style={StyleSheet.absoluteFill} transition={200} />
					<LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={[styles.editorialGradient, { height: s * 0.45 }]} />
					<View style={styles.editorialText}>
						<Text style={[styles.editorialTitle, { maxWidth: s - 20 }]} numberOfLines={1}>
							{item.title}
						</Text>
						<Text style={[styles.editorialArtist, { maxWidth: s - 20 }]} numberOfLines={1}>
							{item.artist}
						</Text>
					</View>
				</Pressable>
			);
		}

		return (
			<Pressable style={[styles.container, { width: s }]} onPress={onPress}>
				<Image source={{ uri: item.artworkUrl }} style={[styles.artwork, { width: s, height: s }]} transition={200} />
				<Text style={[styles.title, { maxWidth: s }]} numberOfLines={1}>
					{item.title}
				</Text>
				<Text style={[styles.artist, { maxWidth: s }]} numberOfLines={1}>
					{item.artist}
				</Text>
			</Pressable>
		);
	},
	(prev, next) =>
		prev.item.id === next.item.id &&
		prev.size === next.size &&
		prev.queue?.length === next.queue?.length &&
		prev.editorial === next.editorial,
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
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
	artist: {
		fontSize: 14,
		textAlign: 'center',
	},
	editorialContainer: {
		borderRadius: 10,
		overflow: 'hidden',
		backgroundColor: '#222',
	},
	editorialGradient: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
	editorialText: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: 10,
	},
	editorialTitle: {
		color: '#fff',
		fontSize: 13,
		fontWeight: '600',
	},
	editorialArtist: {
		color: 'rgba(255,255,255,0.7)',
		fontSize: 12,
	},
});
