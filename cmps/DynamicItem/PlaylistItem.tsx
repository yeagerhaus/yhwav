import { router } from 'expo-router';
import { Dimensions, Image, Pressable, StyleSheet, Text } from 'react-native';

const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 2 - 24;

interface PlaylistItemProps {
	item: {
		id: string;
		title: string;
		artwork: string;
		count: number;
	};
}

export default function PlaylistItem({ item }: PlaylistItemProps) {
	return (
		<Pressable
			style={styles.gridItem}
			onPress={() =>
				router.push({
					// @ts-expect-error
					pathname: '(library)/(playlists)/[playlistId]',
					params: { playlistId: item.id },
				})
			}
		>
			<Image source={{ uri: item.artwork }} style={styles.artwork} />
			<Text style={styles.name} numberOfLines={1}>
				{item.title}
			</Text>
			<Text style={styles.count}>{item.count} songs</Text>
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
