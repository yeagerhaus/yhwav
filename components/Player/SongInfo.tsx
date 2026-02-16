import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Dimensions, Image, StyleSheet } from 'react-native';
import { Div, Text, ContextMenu, type ContextMenuItem } from '@/components';
import { useAddToPlaylist } from '@/hooks/useAddToPlaylist';
import { useAlbums } from '@/hooks/useAlbums';
import { useArtists } from '@/hooks/useArtists';
import { useAudioStore } from '@/hooks/useAudioStore';

const { width } = Dimensions.get('window');

export const SongInfo = React.memo(() => {
	const currentSong = useAudioStore((state) => state.currentSong);
	const { artists } = useArtists();
	const { albums } = useAlbums();
	const openAddToPlaylist = useAddToPlaylist((s) => s.open);

	if (!currentSong) return null;

	const artwork = currentSong.artworkUrl || currentSong.artwork;
	const title = currentSong.title;
	const artist = currentSong.artist;

	// Find matching artist/album by name to get their ratingKey for navigation
	const matchedArtist = artists.find((a) => a.name === currentSong.artist);
	const matchedAlbum = albums.find((a) => a.title === currentSong.album && a.artist === currentSong.artist);

	const menuItems: ContextMenuItem[] = [
		{
			label: 'Add to Playlist',
			systemImage: 'plus.circle',
			onPress: () => {
				if (!currentSong) return;
				openAddToPlaylist(`${currentSong.title} — ${currentSong.artist}`, [currentSong.id]);
			},
		},
		{
			label: 'Go to Album',
			systemImage: 'square.stack',
			onPress: () => {
				if (matchedAlbum) {
					router.back();
					setTimeout(() => {
						router.push(`/(tabs)/(library)/(albums)/${matchedAlbum.id}`);
					}, 100);
				}
			},
		},
		{
			label: 'Go to Artist',
			systemImage: 'person.circle',
			onPress: () => {
				if (matchedArtist) {
					router.back();
					setTimeout(() => {
						router.push(`/(tabs)/(library)/(artists)/${matchedArtist.key}`);
					}, 100);
				}
			},
		},
		{
			label: 'Share',
			systemImage: 'square.and.arrow.up',
			onPress: () => console.log('Share'),
		},
	];

	return (
		<>
			<Div transparent style={styles.artworkContainer}>
				<Image source={{ uri: artwork }} style={styles.artwork} />
			</Div>

			<Div transparent style={styles.titleContainer}>
				<Div transparent style={styles.titleRow}>
					<Div transparent style={styles.titleMain}>
						<Text type='title' style={styles.title}>
							{title}
						</Text>
						<Text
							style={styles.artist}
							// onPress={() => router.push(`/(tabs)/(library)/(artists)/${encodeURIComponent(artist || '')}`)}
						>
							{artist}
						</Text>
					</Div>
					<Div transparent style={styles.titleIcons}>
						{/* <Pressable style={styles.iconButton}>
						<Ionicons name='star-outline' size={18} color='#fff' />
					</Pressable> */}
						<ContextMenu items={menuItems} style={styles.iconButton}>
							<SymbolView name='ellipsis' size={18} tintColor='#fff' />
						</ContextMenu>
					</Div>
				</Div>
			</Div>
		</>
	);
});

const styles = StyleSheet.create({
	artworkContainer: {
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.4,
		shadowRadius: 12,
		elevation: 12,
		backgroundColor: 'transparent',
		marginBottom: 34,
	},
	artwork: {
		width: width - 52,
		height: width - 52,
		borderRadius: 8,
	},
	titleContainer: {
		backgroundColor: 'transparent',
		width: '100%',
		marginTop: 12,
	},
	titleRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		width: '100%',
	},
	titleMain: {
		flex: 1,
	},
	titleIcons: {
		flexDirection: 'row',
		gap: 15,
	},
	title: {
		fontSize: 24,
		color: '#fff',
	},
	artist: {
		fontSize: 18,
		opacity: 0.7,
		color: '#fff',
	},
	iconButton: {
		width: 32,
		height: 32,
		borderRadius: 20,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		justifyContent: 'center',
		alignItems: 'center',
	},
});
