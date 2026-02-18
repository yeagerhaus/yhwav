import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useMemo } from 'react';
import { Image, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { MusicVisualizer } from '@/components/MusicVisualizer';
import { Text } from '@/components/Text';
import { Colors } from '@/constants/styles';
import { useAddToPlaylist } from '@/hooks/useAddToPlaylist';
import { useAlbums } from '@/hooks/useAlbums';
import { useArtists } from '@/hooks/useArtists';
import { useAudioStore } from '@/hooks/useAudioStore';
import { State, usePlaybackState } from '@/lib/playerAdapter';
import type { Song } from '@/types/song';
import { ContextMenu, type ContextMenuItem } from '../ContextMenu';
import { Div } from '../Div';

// Memoized component to prevent unnecessary re-renders
const SongItem = React.memo(
	({ item, queue, listItem }: { item: Song; queue?: Song[]; listItem?: boolean }) => {
		const colorScheme = useColorScheme();
		const playbackState = usePlaybackState();
		const { artists } = useArtists();
		const { albums } = useAlbums();
		const openAddToPlaylist = useAddToPlaylist((s) => s.open);
		const currentSong = useAudioStore((state) => state.currentSong);
		const playSound = useAudioStore((state) => state.playSound);
		const playNext = useAudioStore((state) => state.playNext);
		const addToQueue = useAudioStore((state) => state.addToQueue);
		const isCurrentSong = useMemo(() => {
			return item.id === String(currentSong?.id);
		}, [item.id, currentSong?.id]);

		const playSong = useCallback(
			async (song: Song) => {
				await playSound(song, queue);
			},
			[playSound, queue],
		);

		// Find matching artist/album by name to get their ratingKey for navigation
		const matchedArtist = artists.find((a) => a.name === item.artist);
		const matchedAlbum = albums.find((a) => a.title === item.album && a.artist === item.artist);

		const menuItems: ContextMenuItem[] = [
			{
				label: 'Play Next',
				systemImage: 'text.line.first.and.arrowtriangle.forward',
				onPress: () => playNext(item),
			},
			{
				label: 'Add to Queue',
				systemImage: 'text.badge.plus',
				onPress: () => addToQueue([item]),
			},
			{
				label: 'Add to Playlist',
				systemImage: 'plus.circle',
				onPress: () => openAddToPlaylist(`${item.title} — ${item.artist}`, [item.id]),
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

		if (listItem) {
			return (
				<Pressable onPress={() => playSong(item)} style={styles.songItem}>
					<Div style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }} transparent>
						{isCurrentSong && playbackState.state === State.Playing ? (
							<MusicVisualizer isPlaying={playbackState.state === State.Playing} />
						) : (
							<Text type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
								{item.playlistIndex !== undefined ? item.playlistIndex + 1 : item.trackNumber}
							</Text>
						)}
					</Div>
					<Div
						style={[
							styles.songInfoContainerList,
							{ borderBottomColor: colorScheme === 'light' ? Colors.listDividerLight : Colors.listDividerDark },
						]}
						transparent
					>
						<Div style={styles.songInfo} transparent>
							<Text type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
								{item.title}
							</Text>
							<Div style={styles.artistRow} transparent>
								{item.id === String(currentSong?.id) && (
									<SymbolView name='music.note' size={12} tintColor={Colors.brandPrimary} />
								)}
								<Text type='subtitle' numberOfLines={1} style={styles.songArtist}>
									{item.artist}
								</Text>
							</Div>
						</Div>
						<Div
							transparent
							style={{
								width: 32,
								height: 32,
								borderRadius: 20,
								backgroundColor: '',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<ContextMenu
								items={menuItems}
								style={{
									width: 32,
									height: 32,
									borderRadius: 20,
									backgroundColor: '',
									justifyContent: 'center',
									alignItems: 'center',
								}}
							>
								<SymbolView name='ellipsis' size={18} tintColor='#fff' />
							</ContextMenu>
						</Div>
					</Div>
				</Pressable>
			);
		}

		return (
			<Pressable onPress={() => playSong(item)} style={styles.songItem}>
				<Div transparent style={styles.artworkContainer}>
					<Image source={{ uri: item.artworkUrl }} style={styles.songArtwork} resizeMode='cover' />
					{isCurrentSong && <MusicVisualizer isPlaying={playbackState.state === State.Playing} />}
				</Div>
				<Div
					transparent
					style={[
						styles.songInfoContainer,
						{ borderBottomColor: colorScheme === 'light' ? Colors.listDividerLight : Colors.listDividerDark },
					]}
				>
					<Div transparent style={styles.songInfo}>
						<Text type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
							{item.title}
						</Text>
						<Div transparent style={styles.artistRow}>
							{item.id === String(currentSong?.id) && (
								<SymbolView name='music.note' size={12} tintColor={Colors.brandPrimary} />
							)}
							<Text type='subtitle' numberOfLines={1} style={styles.songArtist}>
								{item.artist}
							</Text>
						</Div>
					</Div>
					<Div
						transparent
						style={{
							width: 32,
							height: 32,
							borderRadius: 20,
							backgroundColor: '',
							justifyContent: 'center',
							alignItems: 'center',
						}}
					>
						<ContextMenu
							items={menuItems}
							style={{
								width: 32,
								height: 32,
								borderRadius: 20,
								backgroundColor: '',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<SymbolView name='ellipsis' size={18} tintColor='#fff' />
						</ContextMenu>
					</Div>
				</Div>
			</Pressable>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison for better memoization
		return (
			prevProps.item.id === nextProps.item.id &&
			prevProps.item.title === nextProps.item.title &&
			prevProps.item.artist === nextProps.item.artist &&
			prevProps.listItem === nextProps.listItem &&
			prevProps.queue?.length === nextProps.queue?.length
		);
	},
);

SongItem.displayName = 'SongItem';

export default SongItem;

const styles = StyleSheet.create({
	songItem: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 12,
	},
	artworkContainer: {
		position: 'relative',
		width: 50,
		height: 50,
	},
	songArtwork: {
		width: '100%',
		height: '100%',
		borderRadius: 4,
	},
	songInfoContainerList: {
		flex: 1,
		gap: 4,
		flexDirection: 'row',
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 4,
		paddingRight: 4,
	},
	songInfoContainer: {
		flex: 1,
		gap: 4,
		flexDirection: 'row',
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 14,
		paddingRight: 14,
	},
	songInfo: {
		flex: 1,
		gap: 4,
		backgroundColor: 'transparent',
	},
	artistRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		backgroundColor: 'transparent',
	},
	songTitle: {
		fontSize: 15,
		fontWeight: '400',
	},
	songArtist: {
		fontSize: 14,
		fontWeight: '400',
		opacity: 0.6,
		marginTop: -4,
	},
	moreButton: {
		padding: 8,
	},
});
