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
	};
}

export default function AlbumItem({ item }: AlbumItemProps) {
	return (
		<Pressable
			style={styles.gridItem}
			onPress={() =>
				router.push({
					// @ts-expect-error
					pathname: '(library)/(albums)/[albumId]',
					params: { albumId: item.id },
				})
			}
		>
			<Image source={{ uri: item.artwork }} style={styles.artwork} />
			<Text style={styles.name} numberOfLines={1}>
				{item.album}
			</Text>
			<Text style={styles.artist} numberOfLines={1}>
				{item.artist}
			</Text>
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
	count: {
		fontSize: 10,
		color: '#666',
		textAlign: 'center',
	},
});
