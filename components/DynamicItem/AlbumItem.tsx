import { router } from 'expo-router';
import { Dimensions, Image, Pressable, StyleSheet, Text } from 'react-native';

const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 2 - 24;

interface AlbumItemProps {
	item: {
		id: string;
		album: string;
		artwork: string;
		artist: string;
		count?: number;
		year?: number;
	};
	size?: number;
}

export default function AlbumItem({ item, size }: AlbumItemProps) {
	const s = size ?? itemSize;
	return (
		<Pressable
			style={[styles.gridItem, size != null && { width: s, marginBottom: 0 }]}
			onPress={() =>
				router.push({
					// @ts-expect-error
					pathname: '(library)/(albums)/[albumId]',
					params: { albumId: item.id },
				})
			}
		>
			<Image source={{ uri: item.artwork }} style={[styles.artwork, size != null && { width: s, height: s }]} />
			<Text style={[styles.name, size != null && { maxWidth: s }]} numberOfLines={1}>
				{item.album}
			</Text>
			<Text style={[styles.artist, size != null && { maxWidth: s }]} numberOfLines={1}>
				{item.artist}
			</Text>
			{item.year != null && (
				<Text style={[styles.year, size != null && { maxWidth: s }]} numberOfLines={1}>
					{item.year}
				</Text>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	gridItem: {
		width: itemSize,
		marginBottom: 24,
		alignItems: 'center',
	},
	artwork: {
		width: itemSize,
		height: itemSize,
		borderRadius: 8,
		marginBottom: 8,
		backgroundColor: '#eee',
	},
	name: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
		maxWidth: itemSize,
	},
	artist: {
		color: '#666',
		fontSize: 14,
		textAlign: 'center',
		maxWidth: itemSize,
	},
	year: {
		fontSize: 10,
		color: '#666',
		textAlign: 'center',
		maxWidth: itemSize,
	},
});
