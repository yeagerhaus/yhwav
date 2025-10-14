import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { State, usePlaybackState } from 'react-native-track-player';
import { MusicVisualizer } from '@/cmps/MusicVisualizer';
import { ThemedText } from '@/cmps/ThemedText';
import { Colors } from '@/constants';
import { useAudio } from '@/ctx/AudioContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { Song } from '@/types/song';
import { Div } from '../Div';

export default function SongItem({ item, queue, listItem }: { item: Song; queue?: Song[]; listItem?: boolean }) {
	const colorScheme = useColorScheme();
	const playbackState = usePlaybackState();
	const { playSound, currentSong } = useAudio();
	const isCurrentSong = useMemo(() => {
		return item.id === String(currentSong?.id);
	}, [item.id, currentSong?.id]);

	const playSong = async (song: Song) => {
		// Format the song data for playSound
		const formattedSong = {
			id: song.id,
			title: song.title || 'Unknown Title',
			artist: song.artist || 'Unknown Artist',
			artwork: song.artworkUrl || song.artwork || '',
			uri: song.uri || song.streamUrl || '',
		};

		// Format the queue if available
		const formattedQueue = queue?.map((q) => ({
			id: q.id,
			title: q.title || 'Unknown Title',
			artist: q.artist || 'Unknown Artist',
			artwork: q.artworkUrl || q.artwork || '',
			uri: q.uri || q.streamUrl || '',
		}));

		await playSound(formattedSong, formattedQueue);
	};

	if (listItem) {
		return (
			<Pressable onPress={() => playSong(item)} style={styles.songItem}>
				<Div style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
					{isCurrentSong && playbackState.state === State.Playing ? (
						<MusicVisualizer isPlaying={playbackState.state === State.Playing} />
					) : (
						<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
							{item.playlistIndex !== undefined ? item.playlistIndex + 1 : item.trackNumber}
						</ThemedText>
					)}
				</Div>
				<Div style={[styles.songInfoContainerList, { borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' }]}>
					<Div style={styles.songInfo}>
						<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
							{item.title}
						</ThemedText>
						<Div style={styles.artistRow}>
							{item.id === String(currentSong?.id) && (
								<SymbolView name='music.note' size={12} tintColor={Colors.brand.primary} />
							)}
							<ThemedText type='subtitle' numberOfLines={1} style={styles.songArtist}>
								{item.artist}
							</ThemedText>
						</Div>
					</Div>
					<Pressable style={styles.moreButton}>
						<SymbolView name='ellipsis' size={20} tintColor='#222222' />
					</Pressable>
				</Div>
			</Pressable>
		);
	}

	return (
		<Pressable onPress={() => playSong(item)} style={styles.songItem}>
			<Div style={styles.artworkContainer}>
				<Image source={{ uri: item.artworkUrl }} style={styles.songArtwork} />
				{isCurrentSong && <MusicVisualizer isPlaying={playbackState.state === State.Playing} />}
			</Div>
			<Div style={[styles.songInfoContainer, { borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' }]}>
				<Div style={styles.songInfo}>
					<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
						{item.title}
					</ThemedText>
					<Div style={styles.artistRow}>
						{item.id === String(currentSong?.id) && <SymbolView name='music.note' size={12} tintColor='#FA2D48' />}
						<ThemedText type='subtitle' numberOfLines={1} style={styles.songArtist}>
							{item.artist}
						</ThemedText>
					</Div>
				</Div>
				<Pressable style={styles.moreButton}>
					<SymbolView name='ellipsis' size={20} tintColor='#222222' />
				</Pressable>
			</Div>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	scrollView: { flex: 1 },
	titleContainer: {
		flexDirection: 'column',
		paddingHorizontal: 16,
		paddingVertical: 16,
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
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
	headerButtons: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 20,
		position: 'absolute',
		bottom: 30,
		marginHorizontal: 20,
	},
	headerButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(0,0,0,0.1)',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 10,
		gap: 8,
		flex: 1,
		justifyContent: 'center',
	},
	headerButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
});
