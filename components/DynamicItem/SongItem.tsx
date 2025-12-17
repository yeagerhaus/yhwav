import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { State, usePlaybackState } from 'react-native-track-player';
import { MusicVisualizer } from '@/components/MusicVisualizer';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants';
import { useAudioStore } from '@/hooks/useAudioStore';
import type { Song } from '@/types/song';
import { Div } from '../Div';

export default function SongItem({ item, queue, listItem }: { item: Song; queue?: Song[]; listItem?: boolean }) {
	const colorScheme = useColorScheme();
	const playbackState = usePlaybackState();
	const currentSong = useAudioStore((state) => state.currentSong);
	const playSound = useAudioStore((state) => state.playSound);
	const isCurrentSong = useMemo(() => {
		return item.id === String(currentSong?.id);
	}, [item.id, currentSong?.id]);

	const playSong = async (song: Song) => {
		await playSound(song, queue);
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
						{item.id === String(currentSong?.id) && <SymbolView name='music.note' size={12} tintColor={Colors.brand.primary} />}
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
