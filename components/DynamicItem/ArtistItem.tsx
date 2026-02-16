import { router } from 'expo-router';
import { Dimensions, Image, Pressable, StyleSheet, View } from 'react-native';
import { Div } from '../Div';
import { Text } from '../Text';

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
	return (
		<Pressable
				style={styles.item}
				onPress={() =>
					router.push({
						// @ts-expect-error
						pathname: '(library)/(artists)/[artistId]',
						params: { artistId: item.key },
					})
				}
			>
				{item.thumb ? (
					<Image source={{ uri: item.thumb }} style={styles.image} />
				) : (
					<Div style={styles.initialCircle} transparent>
						<Text style={styles.initialText}>{item.name.charAt(0).toUpperCase()}</Text>
					</Div>
				)}
				<Div style={{ flex: 1 }} transparent>
					<Text style={styles.name}>{item.name}</Text>
					{item.genres && item.genres.length > 0 && <Text style={styles.genres}>{item.genres.slice(0, 3).join(', ')}</Text>}
				</Div>
			</Pressable>
	);
}

const styles = StyleSheet.create({
	item: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
	image: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ddd' },
	initialCircle: {
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: '#FA2D48',
		justifyContent: 'center',
		alignItems: 'center',
	},
	initialText: { fontSize: 20, fontWeight: 'bold', color: 'white' },
	name: { fontSize: 18, fontWeight: '500' },
	genres: { fontSize: 14, color: '#666' },
});
