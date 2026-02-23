import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { MusicVisualizer } from '@/components/MusicVisualizer';
import { Text } from '@/components/Text';
import { Colors } from '@/constants/styles';
import { useAddToPlaylist } from '@/hooks/useAddToPlaylist';
import { useAlbums } from '@/hooks/useAlbums';
import { useArtists } from '@/hooks/useArtists';
import { useAudioStore } from '@/hooks/useAudioStore';
import { State, usePlaybackState } from '@/lib/playerAdapter';
import type { Song } from '@/types/song';
import { Div } from '../Div';

interface SearchSongItemProps {
	song: Song;
	query: string;
	onPress?: () => void;
}

export default function SearchSongItem({ song, query, onPress }: SearchSongItemProps) {
	const colorScheme = useColorScheme();
	const playbackState = usePlaybackState();
	const currentSong = useAudioStore((state) => state.currentSong);
	const playSound = useAudioStore((state) => state.playSound);
	const playNext = useAudioStore((state) => state.playNext);
	const addToQueue = useAudioStore((state) => state.addToQueue);
	const { artists } = useArtists();
	const { albums } = useAlbums();
	const openAddToPlaylist = useAddToPlaylist((s) => s.open);

	const isCurrentSong = useMemo(() => {
		return song.id === String(currentSong?.id);
	}, [song.id, currentSong?.id]);

	const matchedArtist = artists.find((a) => a.name === song.artist);
	const matchedAlbum = albums.find((a) => a.title === song.album && a.artist === song.artist);

	const menuItems: ContextMenuItem[] = [
		{
			label: 'Play Next',
			systemImage: 'text.line.first.and.arrowtriangle.forward',
			onPress: () => playNext(song),
		},
		{
			label: 'Add to Queue',
			systemImage: 'text.badge.plus',
			onPress: () => addToQueue([song]),
		},
		{
			label: 'Add to Playlist',
			systemImage: 'plus.circle',
			onPress: () => openAddToPlaylist(`${song.title} — ${song.artist}`, [song.id]),
		},
		{
			label: 'Go to Album',
			systemImage: 'square.stack',
			onPress: () => {
				if (matchedAlbum) {
					router.push(`/(tabs)/(library)/(albums)/${matchedAlbum.id}`);
				}
			},
		},
		{
			label: 'Go to Artist',
			systemImage: 'person.circle',
			onPress: () => {
				if (matchedArtist) {
					router.push(`/(tabs)/(library)/(artists)/${matchedArtist.key}`);
				}
			},
		},
	];

	const playSong = async () => {
		await playSound(song);
		onPress?.();
	};

	const highlightText = (text: string, query: string) => {
		if (!query) return text;

		const parts = text.split(new RegExp(`(${query})`, 'gi'));
		return parts.map((part, index) =>
			part.toLowerCase() === query.toLowerCase() ? (
				<Text key={index} style={styles.highlighted}>
					{part}
				</Text>
			) : (
				part
			),
		);
	};

	return (
		<Pressable onPress={playSong} style={styles.songItem}>
			<Div transparent style={styles.artworkContainer}>
				<Image source={{ uri: song.artworkUrl || song.artwork }} style={styles.songArtwork} />
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
						{highlightText(song.title, query)}
					</Text>
					<Div transparent style={styles.artistRow}>
						{isCurrentSong && <SymbolView name='music.note' size={12} tintColor={Colors.brandPrimary} />}
						<Text type='subtitle' numberOfLines={1} style={styles.songArtist}>
							{highlightText(song.artist, query)}
						</Text>
					</Div>
					<Text type='subtitle' numberOfLines={1} style={styles.songAlbum}>
						{highlightText(song.album, query)}
					</Text>
				</Div>
				<ContextMenu items={menuItems} style={styles.moreButton}>
					<SymbolView name='ellipsis' size={20} tintColor='#999' />
				</ContextMenu>
			</Div>
		</Pressable>
	);
}

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
	songInfoContainer: {
		flex: 1,
		gap: 4,
		flexDirection: 'row',
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	songInfo: {
		flex: 1,
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
	},
	songAlbum: {
		fontSize: 12,
		fontWeight: '400',
		opacity: 0.5,
	},
	moreButton: {
		padding: 8,
	},
	highlighted: {
		backgroundColor: Colors.brandPrimary,
		color: 'white',
		fontWeight: '600',
	},
});
