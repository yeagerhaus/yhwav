import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useAddToPlaylist } from '@/hooks/useAddToPlaylist';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import type { Album } from '@/types/album';
import { Div } from '../Div';

interface SearchAlbumItemProps {
	album: Album;
	query: string;
	onPress?: () => void;
}

export default function SearchAlbumItem({ album, query, onPress }: SearchAlbumItemProps) {
	const colorScheme = useColorScheme();
	const openAddToPlaylist = useAddToPlaylist((s) => s.open);
	const allTracks = useLibraryStore((s) => s.tracks);

	const albumTrackIds = useMemo(
		() => allTracks.filter((t) => t.album === album.title && t.artist === album.artist).map((t) => t.id),
		[allTracks, album.title, album.artist],
	);

	const handlePress = () => {
		router.push({
			// @ts-expect-error
			pathname: '(library)/(albums)/[albumId]',
			params: { albumId: album.id },
		});
		onPress?.();
	};

	const menuItems: ContextMenuItem[] = [
		{
			label: 'Add to Playlist',
			systemImage: 'plus.circle',
			onPress: () => openAddToPlaylist(`${album.title} — ${album.artist}`, albumTrackIds),
			disabled: albumTrackIds.length === 0,
		},
	];

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

	const artworkUri = album.thumb || album.artwork;

	return (
		<Pressable onPress={handlePress} style={styles.albumItem}>
			<Image source={{ uri: artworkUri }} style={styles.albumArtwork} />
			<Div style={[styles.albumInfoContainer, { borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' }]}>
				<Div style={styles.albumInfo}>
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
				</Div>
				<ContextMenu items={menuItems} style={styles.moreButton}>
					<SymbolView name='ellipsis' size={20} tintColor='#999' />
				</ContextMenu>
			</Div>
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
	moreButton: {
		padding: 8,
	},
	highlighted: {
		backgroundColor: Colors.brand.primary,
		color: 'white',
		fontWeight: '600',
	},
});
