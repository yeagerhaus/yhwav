import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Image, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import type { Playlist } from '@/types/playlist';
import { Div } from '../Div';

interface SearchPlaylistItemProps {
	playlist: Playlist;
	query: string;
	onPress?: () => void;
}

export default function SearchPlaylistItem({ playlist, query, onPress }: SearchPlaylistItemProps) {
	const colorScheme = useColorScheme();

	const handlePress = () => {
		router.push({
			// @ts-expect-error
			pathname: '(library)/(playlists)/[playlistId]',
			params: { playlistId: playlist.key || playlist.id },
		});
		onPress?.();
	};

	const highlightText = (text: string, q: string) => {
		if (!q) return text;

		const parts = text.split(new RegExp(`(${q})`, 'gi'));
		return parts.map((part, index) =>
			part.toLowerCase() === q.toLowerCase() ? (
				<ThemedText key={index} style={styles.highlighted}>
					{part}
				</ThemedText>
			) : (
				part
			),
		);
	};

	return (
		<Pressable onPress={handlePress} style={styles.item}>
			{playlist.artworkUrl ? (
				<Image source={{ uri: playlist.artworkUrl }} style={styles.artwork} />
			) : (
				<Div style={styles.iconContainer}>
					<SymbolView name='music.note.list' size={24} tintColor='#ddd' />
				</Div>
			)}
			<Div style={[styles.infoContainer, { borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' }]}>
				<Div style={styles.info}>
					<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.title}>
						{highlightText(playlist.title, query)}
					</ThemedText>
					<ThemedText type='subtitle' numberOfLines={1} style={styles.subtitle}>
						{playlist.leafCount ?? 0} tracks
					</ThemedText>
				</Div>
			</Div>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	item: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 12,
	},
	artwork: {
		width: 50,
		height: 50,
		borderRadius: 4,
	},
	iconContainer: {
		width: 50,
		height: 50,
		borderRadius: 4,
		backgroundColor: '#333',
		justifyContent: 'center',
		alignItems: 'center',
	},
	infoContainer: {
		flex: 1,
		gap: 4,
		flexDirection: 'row',
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 14,
		paddingRight: 14,
	},
	info: {
		flex: 1,
		gap: 2,
		backgroundColor: 'transparent',
	},
	title: {
		fontSize: 15,
		fontWeight: '400',
	},
	subtitle: {
		fontSize: 14,
		fontWeight: '400',
		opacity: 0.6,
	},
	highlighted: {
		backgroundColor: Colors.brand.primary,
		color: 'white',
		fontWeight: '600',
	},
});
