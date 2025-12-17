import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import type { Artist } from '@/types/artist';

interface SearchArtistItemProps {
	artist: Artist;
	query: string;
	onPress?: () => void;
}

export default function SearchArtistItem({ artist, query, onPress }: SearchArtistItemProps) {
	const colorScheme = useColorScheme();
	const { albumsById } = useLibraryStore();

	const handlePress = () => {
		router.push({
			// @ts-expect-error
			pathname: '(library)/(artists)/[artistKey]',
			params: { artistKey: artist.key },
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

	const albumCount = artist.albumIds.length;
	const totalSongs = artist.albumIds.reduce((total, albumId) => {
		const album = albumsById[albumId];
		return total + (album?.songIds.length || 0);
	}, 0);

	return (
		<Pressable onPress={handlePress} style={styles.artistItem}>
			<ThemedView style={styles.artistIconContainer}>
				<ThemedText style={styles.artistIcon}>{artist.name.charAt(0).toUpperCase()}</ThemedText>
			</ThemedView>
			<ThemedView style={[styles.artistInfoContainer, { borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' }]}>
				<ThemedView style={styles.artistInfo}>
					<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.artistName}>
						{highlightText(artist.name, query)}
					</ThemedText>
					<ThemedText type='subtitle' numberOfLines={1} style={styles.artistStats}>
						{albumCount} album{albumCount !== 1 ? 's' : ''} • {totalSongs} song{totalSongs !== 1 ? 's' : ''}
					</ThemedText>
				</ThemedView>
			</ThemedView>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	artistItem: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 12,
	},
	artistIconContainer: {
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: '#FA2D48',
		justifyContent: 'center',
		alignItems: 'center',
	},
	artistIcon: {
		fontSize: 20,
		fontWeight: 'bold',
		color: 'white',
	},
	artistInfoContainer: {
		flex: 1,
		gap: 4,
		flexDirection: 'row',
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 14,
		paddingRight: 14,
	},
	artistInfo: {
		flex: 1,
		gap: 2,
		backgroundColor: 'transparent',
	},
	artistName: {
		fontSize: 15,
		fontWeight: '400',
	},
	artistStats: {
		fontSize: 12,
		fontWeight: '400',
		opacity: 0.6,
	},
	highlighted: {
		backgroundColor: '#FA2D48',
		color: 'white',
		fontWeight: '600',
	},
});
