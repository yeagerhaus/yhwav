import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { State, usePlaybackState } from 'react-native-track-player';
import { MusicVisualizer } from '@/cmps/MusicVisualizer';
import { ThemedText } from '@/cmps/ThemedText';
import { ThemedView } from '@/cmps/ThemedView';
import { useAudio } from '@/ctx/AudioContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { Song } from '@/types/song';

interface SearchSongItemProps {
	song: Song;
	query: string;
	onPress?: () => void;
}

export default function SearchSongItem({ song, query, onPress }: SearchSongItemProps) {
	const colorScheme = useColorScheme();
	const playbackState = usePlaybackState();
	const { playSound, currentSong } = useAudio();

	const isCurrentSong = useMemo(() => {
		return song.id === String(currentSong?.id);
	}, [song.id, currentSong?.id]);

	const playSong = async () => {
		const formattedSong = {
			id: song.id,
			title: song.title || 'Unknown Title',
			artist: song.artist || 'Unknown Artist',
			artwork: song.artworkUrl || song.artwork || '',
			uri: song.uri || song.streamUrl || '',
		};

		await playSound(formattedSong);
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

	return (
		<Pressable onPress={playSong} style={styles.songItem}>
			<View style={styles.artworkContainer}>
				<Image source={{ uri: song.artworkUrl || song.artwork }} style={styles.songArtwork} />
				{isCurrentSong && <MusicVisualizer isPlaying={playbackState.state === State.Playing} />}
			</View>
			<ThemedView style={[styles.songInfoContainer, { borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' }]}>
				<ThemedView style={styles.songInfo}>
					<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
						{highlightText(song.title, query)}
					</ThemedText>
					<ThemedView style={styles.artistRow}>
						{isCurrentSong && <Ionicons name='musical-note' size={12} color='#FA2D48' />}
						<ThemedText type='subtitle' numberOfLines={1} style={styles.songArtist}>
							{highlightText(song.artist, query)}
						</ThemedText>
					</ThemedView>
					<ThemedText type='subtitle' numberOfLines={1} style={styles.songAlbum}>
						{highlightText(song.album, query)}
					</ThemedText>
				</ThemedView>
				<Pressable style={styles.moreButton}>
					<MaterialIcons name='more-horiz' size={20} color='#222222' />
				</Pressable>
			</ThemedView>
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
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 14,
		paddingRight: 14,
	},
	songInfo: {
		flex: 1,
		gap: 2,
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
		backgroundColor: '#FA2D48',
		color: 'white',
		fontWeight: '600',
	},
});
