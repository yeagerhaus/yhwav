import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Dimensions, Image, StyleSheet, View as ThemedView } from 'react-native';
import { ContextMenu, type ContextMenuItem } from '@/cmps/ContextMenu';
import { ThemedText } from '@/cmps/ThemedText';
import { useAudioStore } from '@/hooks/useAudioStore';

const { width } = Dimensions.get('window');

export const SongInfo = React.memo(() => {
	const currentSong = useAudioStore((state) => state.currentSong);

	if (!currentSong) return null;

	const artwork = currentSong.artworkUrl || currentSong.artwork;
	const title = currentSong.title;
	const artist = currentSong.artist;

	const menuItems: ContextMenuItem[] = [
		{
			label: 'Add to Playlist',
			systemImage: 'plus.circle',
			onPress: () => console.log('Add to Playlist'),
		},
		{
			label: 'Go to Album',
			systemImage: 'square.stack',
			onPress: () => {
				if (currentSong.album) {
					router.back();
					// Small delay to allow the modal to dismiss before navigation
					setTimeout(() => {
						router.push(`/(tabs)/(library)/(albums)/${encodeURIComponent(currentSong.album)}`);
					}, 100);
				}
			},
		},
		{
			label: 'Go to Artist',
			systemImage: 'person.circle',
			onPress: () => {
				if (currentSong.artist) {
					router.back();
					// Small delay to allow the modal to dismiss before navigation
					setTimeout(() => {
						router.push(`/(tabs)/(library)/(artists)/${encodeURIComponent(currentSong.artist)}`);
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
			<ThemedView style={styles.artworkContainer}>
				<Image source={{ uri: artwork }} style={styles.artwork} />
			</ThemedView>

			<ThemedView style={styles.titleContainer}>
				<ThemedView style={styles.titleRow}>
					<ThemedView style={styles.titleMain}>
						<ThemedText type='title' style={styles.title}>
							{title}
						</ThemedText>
						<ThemedText
							style={styles.artist}
							// onPress={() => router.push(`/(tabs)/(library)/(artists)/${encodeURIComponent(artist || '')}`)}
						>
							{artist}
						</ThemedText>
					</ThemedView>
					<ThemedView style={styles.titleIcons}>
						{/* <Pressable style={styles.iconButton}>
						<Ionicons name='star-outline' size={18} color='#fff' />
					</Pressable> */}
						<ContextMenu items={menuItems} style={styles.iconButton}>
							<SymbolView name='ellipsis' size={18} tintColor='#fff' />
						</ContextMenu>
					</ThemedView>
				</ThemedView>
			</ThemedView>
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
