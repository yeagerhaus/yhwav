import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { State, usePlaybackState } from 'react-native-track-player';
import { MusicVisualizer } from '@/components/MusicVisualizer';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants';
import { useAudioStore } from '@/hooks/useAudioStore';
import type { Song } from '@/types/song';

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

	const isCurrentSong = useMemo(() => {
		return song.id === String(currentSong?.id);
	}, [song.id, currentSong?.id]);

	const playSong = async () => {
		await playSound(song);
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
						{isCurrentSong && <SymbolView name='music.note' size={12} tintColor={Colors.brand.primary} />}
						<ThemedText type='subtitle' numberOfLines={1} style={styles.songArtist}>
							{highlightText(song.artist, query)}
						</ThemedText>
					</ThemedView>
					<ThemedText type='subtitle' numberOfLines={1} style={styles.songAlbum}>
						{highlightText(song.album, query)}
					</ThemedText>
				</ThemedView>
				<Pressable style={styles.moreButton}>
					<SymbolView name='ellipsis' size={20} tintColor='#222222' />
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
		backgroundColor: Colors.brand.primary,
		color: 'white',
		fontWeight: '600',
	},
});
