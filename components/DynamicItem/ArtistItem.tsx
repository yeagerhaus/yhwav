import { router } from 'expo-router';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';

const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 2 - 24;

interface ArtistItemProps {
	item: {
		key: string;
		name: string;
		thumb?: string;
		genres?: string[];
	};
	size?: number;
}

export default function ArtistItem({ item, size }: ArtistItemProps) {
	const s = size ?? itemSize;
	const radius = s / 2;
	const initialFontSize = Math.round(40 * (s / itemSize));
	return (
		<Pressable
			style={[styles.gridItem, size != null && { width: s, marginBottom: 0 }]}
			onPress={() =>
				router.push({
					// @ts-expect-error
					pathname: '(library)/(artists)/[artistId]',
					params: { artistId: item.key },
				})
			}
		>
			{item.thumb ? (
				<Image
					source={{ uri: item.thumb }}
					style={[styles.artwork, size != null && { width: s, height: s, borderRadius: radius }]}
				/>
			) : (
				<View style={[styles.placeholder, size != null && { width: s, height: s, borderRadius: radius }]}>
					<Text style={[styles.initial, size != null && { fontSize: initialFontSize }]}>{item.name.charAt(0).toUpperCase()}</Text>
				</View>
			)}
			<Text style={[styles.name, size != null && { maxWidth: s }]} numberOfLines={1}>
				{item.name}
			</Text>
			{item.genres && item.genres.length > 0 && (
				<Text style={[styles.genre, size != null && { maxWidth: s }]} numberOfLines={1}>
					{item.genres.slice(0, 2).join(', ')}
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
		borderRadius: itemSize / 2,
		marginBottom: 8,
		backgroundColor: '#000',
	},
	placeholder: {
		width: itemSize,
		height: itemSize,
		borderRadius: itemSize / 2,
		marginBottom: 8,
		backgroundColor: '#FA2D48',
		justifyContent: 'center',
		alignItems: 'center',
	},
	initial: {
		fontSize: 40,
		fontWeight: 'bold',
		color: 'white',
	},
	name: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
		maxWidth: itemSize,
	},
	genre: {
		fontSize: 12,
		color: '#666',
		textAlign: 'center',
		maxWidth: itemSize,
	},
});
