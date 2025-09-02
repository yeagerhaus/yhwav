import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import TrackPlayer, { usePlaybackState, State } from 'react-native-track-player';

import { useAudio } from '@/ctx/AudioContext';

import { MusicVisualizer } from '@/cmps/MusicVisualizer';
import { ThemedText } from '@/cmps/ThemedText';
import { ThemedView } from '@/cmps/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Song } from '@/types/song';

export default function ListItem({ item, queue }: { item: Song; queue?: Song[] }) {
const colorScheme = useColorScheme();
const [songs, setSongs] = useState<Song[]>([]);
const playbackState = usePlaybackState();
const { playSound, currentSong } = useAudio();
const isCurrentSong = item.title === String(currentSong?.title) && item.id === String(currentSong?.id)

const playSong = async (song: Song) => {
	console.log('🎵 Playing song from SongItem:', {
		songId: song.id,
		songTitle: song.title,
		queueLength: queue?.length || 0,
		songUri: song.uri || song.streamUrl
	});
	
	// Format the song data for playSound
	const formattedSong = {
		id: song.id,
		title: song.title || 'Unknown Title',
		artist: song.artist || 'Unknown Artist',
		artwork: song.artworkUrl || song.artwork || '',
		uri: song.uri || song.streamUrl || '',
	};
	
	// Format the queue if available
	const formattedQueue = queue?.map(q => ({
		id: q.id,
		title: q.title || 'Unknown Title',
		artist: q.artist || 'Unknown Artist',
		artwork: q.artworkUrl || q.artwork || '',
		uri: q.uri || q.streamUrl || '',
	}));
	
	await playSound(formattedSong, formattedQueue);
};

return (
	<Pressable onPress={() => playSong(item)} style={styles.songItem}>
		<View style={styles.artworkContainer}>
			<Image source={{ uri: item.artworkUrl }} style={styles.songArtwork} />
			{isCurrentSong && <MusicVisualizer isPlaying={playbackState.state === State.Playing} />}
		</View>
		<ThemedView
			style={[
			styles.songInfoContainer,
			{ borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' },
			]}
		>
			<ThemedView style={styles.songInfo}>
				<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
					{item.title}
				</ThemedText>
				<ThemedView style={styles.artistRow}>
					{item.id === String(currentSong?.id) && <Ionicons name='musical-note' size={12} color='#FA2D48' />}
					<ThemedText type='subtitle' numberOfLines={1} style={styles.songArtist}>
					{item.artist}
					</ThemedText>
				</ThemedView>
			</ThemedView>
			<Pressable style={styles.moreButton}>
				<MaterialIcons name='more-horiz' size={20} color='#222222' />
			</Pressable>
		</ThemedView>
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
