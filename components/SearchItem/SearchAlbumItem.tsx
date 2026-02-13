import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import type { Album } from '@/types/album';
import { Colors } from '@/constants/Colors';

interface SearchAlbumItemProps {
	album: Album;
	query: string;
	onPress?: () => void;
}

export default function SearchAlbumItem({ album, query, onPress }: SearchAlbumItemProps) {
	const colorScheme = useColorScheme();

	const handlePress = () => {
		router.push({
			// @ts-expect-error
			pathname: '(library)/(albums)/[albumId]',
			params: { albumId: album.id },
		});
		onPress?.();
	};

	const highlightText = (text: string, query: string) => {
		if (!query) return text;

		const parts = text.split(new RegExp(`(${query})`, 'gi'));
		return parts.map((part, index) =>
			part.toLowerCase() === query.toLowerCase() ? (
				<ThemedText key={index} style={styles.highlighted}>
					{part}
				</ThemedText>
			) : (
				part
			),
		);
	};

	const artworkUri = album.thumb || album.artwork;

	return (
		<Pressable onPress={handlePress} style={styles.albumItem}>
			<Image source={{ uri: artworkUri }} style={styles.albumArtwork} />
			<ThemedView style={[styles.albumInfoContainer, { borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' }]}>
				<ThemedView style={styles.albumInfo}>
					<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.albumTitle}>
						{highlightText(album.title, query)}
					</ThemedText>
					<ThemedText type='subtitle' numberOfLines={1} style={styles.albumArtist}>
						{highlightText(album.artist, query)}
					</ThemedText>
					{album.year && (
						<ThemedText type='subtitle' numberOfLines={1} style={styles.albumYear}>
							{album.year}
						</ThemedText>
					)}
				</ThemedView>
			</ThemedView>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	albumItem: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 12,
	},
	albumArtwork: {
		width: 50,
		height: 50,
		borderRadius: 4,
	},
	albumInfoContainer: {
		flex: 1,
		gap: 4,
		flexDirection: 'row',
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 14,
		paddingRight: 14,
	},
	albumInfo: {
		flex: 1,
		gap: 2,
		backgroundColor: 'transparent',
	},
	albumTitle: {
		fontSize: 15,
		fontWeight: '400',
	},
	albumArtist: {
		fontSize: 14,
		fontWeight: '400',
		opacity: 0.6,
	},
	albumYear: {
		fontSize: 12,
		fontWeight: '400',
		opacity: 0.5,
	},
	highlighted: {
		backgroundColor: Colors.brand.primary,
		color: 'white',
		fontWeight: '600',
	},
});
