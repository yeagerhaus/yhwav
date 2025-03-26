import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { MusicVisualizer } from '@/cmps/MusicVisualizer';
import ParallaxScrollView from '@/cmps/ParallaxScrollView';
import { ThemedText } from '@/cmps/ThemedText';
import { ThemedView } from '@/cmps/ThemedView';
import { useAudio } from '@/ctx/AudioContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fetchAPI } from '@/utils/fetch';

interface Song {
	id: number;
	title: string;
	artist: string;
	artwork: string;
}

export default function HomeScreen() {
	const _router = useRouter();
	const { currentSong, playSound, isPlaying, togglePlayPause } = useAudio();
	const colorScheme = useColorScheme();
	const [songs, setSongs] = useState<Song[]>([]);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		// Fetch songs from API
		const fetchSongs = async () => {
			setLoading(true);
			const [songs, err] = await fetchAPI<Song[]>('/tracks', 'GET');
			if (err) {
				console.error(err);
				setLoading(false);
				return;
			}
			setSongs(songs);
			setLoading(false);
		};
		fetchSongs();
	}, []);

	const handlePlayFirst = () => {
		if (songs.length > 0) {
			playSound(songs[0]);
		}
	};

	const handleShuffle = () => {
		if (songs.length > 0) {
			const randomSong = songs[Math.floor(Math.random() * songs.length)];
			playSound(randomSong);
		}
	};

	const renderSongItem = ({ item }: { item: Song }) => (
		<Pressable
			onPress={() => {
				playSound(item);
				// router.push(`/music/${item.id}`);
			}}
			style={styles.songItem}
		>
			<View style={styles.artworkContainer}>
				<Image source={{ uri: item.artwork }} style={styles.songArtwork} />
				{Number(item.id) === currentSong?.id && <MusicVisualizer isPlaying={isPlaying} />}
			</View>

			<ThemedView style={[styles.songInfoContainer, { borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' }]}>
				<ThemedView style={styles.songInfo}>
					<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
						{item.title}
					</ThemedText>
					<ThemedView style={styles.artistRow}>
						{Number(item.id) === currentSong?.id && <Ionicons name='musical-note' size={12} color='#FA2D48' />}
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

	if (loading) {
		return (
			<ThemedView style={styles.container}>
				<Text>Loading...</Text>
			</ThemedView>
		);
	}

	return (
		<ThemedView style={styles.container}>
			<ParallaxScrollView
				headerBackgroundColor={{ light: '#f57a8a', dark: '#FA2D48' }}
				headerImage={
					<ThemedView
						style={{
							flex: 1,
							width: '100%',
							height: '100%',
							position: 'absolute',
							top: 0,
							left: 0,
							alignItems: 'center',
						}}
					>
						<Image
							source={{
								uri: 'https://9to5mac.com/wp-content/uploads/sites/6/2021/08/apple-music-logo-2021-9to5mac.jpg?quality=82&strip=all&w=1024',
							}}
							style={{
								position: 'absolute',
								width: '100%',
								height: '100%',
							}}
						/>
						<Text
							style={{
								fontSize: 18,
								letterSpacing: -0.5,
								alignSelf: 'center',
								position: 'absolute',
								top: 80,
								color: '#fff', // Added white color for better visibility
							}}
						>
							Built with Expo
						</Text>

						<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
							<View style={styles.headerButtons}>
								<Pressable style={styles.headerButton} onPress={handlePlayFirst}>
									<Ionicons name='play' size={24} color='#fff' />
									<Text style={styles.headerButtonText}>Play</Text>
								</Pressable>
								<Pressable style={styles.headerButton} onPress={handleShuffle}>
									<Ionicons name='shuffle' size={24} color='#fff' />
									<Text style={styles.headerButtonText}>Shuffle</Text>
								</Pressable>
							</View>
						</View>
					</ThemedView>
				}
				contentContainerStyle={styles.scrollView}
			>
				<ThemedView style={styles.titleContainer}>
					<ThemedView style={styles.titleRow}>
						<ThemedText type='title'>Billboard Top 20</ThemedText>
					</ThemedView>
					<ThemedText type='subtitle'>
						{new Date().toLocaleDateString('en-US', {
							month: 'long',
							day: 'numeric',
							year: 'numeric',
						})}
					</ThemedText>
				</ThemedView>

				<FlatList data={songs} renderItem={renderSongItem} keyExtractor={(item) => item.id.toString()} scrollEnabled={false} />
			</ParallaxScrollView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
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
		paddingLeft: 16,
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
	songInfoContainer: {
		flex: 1,
		gap: 4,
		flexDirection: 'row',
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 14,
		paddingRight: 14,
	},
});
