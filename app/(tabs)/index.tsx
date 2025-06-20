import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { MusicVisualizer } from '@/cmps/MusicVisualizer';
import ParallaxScrollView from '@/cmps/ParallaxScrollView';
import { ThemedText } from '@/cmps/ThemedText';
import { ThemedView } from '@/cmps/ThemedView';
import { useAudio } from '@/ctx/AudioContext';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Song {
	id: number;
	title: string;
	artist: string;
	artwork: string;
	filename: string;
	uri: string;
}

export default function HomeScreen() {
	const _router = useRouter();
	const { currentSong, playSound, isPlaying } = useAudio();
	const colorScheme = useColorScheme();
	const [songs, setSongs] = useState<Song[]>([]);
	const [_loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		loadSongsFromDirectory();
	}, []);

	const loadSongsFromDirectory = async () => {
		try {
			const dirUri = `${FileSystem.documentDirectory}songs/`;
			await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });

			const files = await FileSystem.readDirectoryAsync(dirUri);
			const audioFiles = files.filter((f) => f.endsWith('.m4a') || f.endsWith('.mp3'));

			const localSongs: Song[] = audioFiles.map((filename, index) => ({
				id: index,
				title: filename.replace(/\.[^/.]+$/, ''),
				artist: 'Unknown Artist',
				artwork: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Speaker_Icon.svg',
				filename,
				uri: dirUri + filename,
			}));

			setSongs(localSongs);
		} catch (err) {
			console.error('Error loading songs from local directory:', err);
		} finally {
			setLoading(false);
		}
	};

	const pickAndImportSongs = async () => {
		try {
			const result = await DocumentPicker.getDocumentAsync({
				type: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'],
				multiple: true,
				copyToCacheDirectory: false,
			});
			console.log('DocumentPicker result:', result);

			if (result.assets?.length) {
				for (const file of result.assets) {
					const filename = file.name;
					const destination = `${FileSystem.documentDirectory}songs/${filename}`;

					await FileSystem.copyAsync({
						from: file.uri,
						to: destination,
					});
				}

				await loadSongsFromDirectory(); // refresh
			}
		} catch (err) {
			console.error('Failed to import songs:', err);
		}
	};

	const deleteAllSongs = async () => {
		try {
			const dirUri = `${FileSystem.documentDirectory}songs/`;
			const files = await FileSystem.readDirectoryAsync(dirUri);

			for (const file of files) {
				await FileSystem.deleteAsync(dirUri + file, { idempotent: true });
			}

			console.log('All local songs deleted.');
			setSongs([]);
		} catch (err) {
			console.error('Failed to delete songs:', err);
		}
	};

	const handlePlayFirst = () => {
		if (songs.length > 0) playSound(songs[0]);
	};

	const handleShuffle = () => {
		if (songs.length === 0) return;
		const randomSong = songs[Math.floor(Math.random() * songs.length)];
		playSound(randomSong);
	};

	const renderSongItem = ({ item }: { item: Song }) => (
		<Pressable onPress={() => playSound(item)} style={styles.songItem}>
			<View style={styles.artworkContainer}>
				<Image source={{ uri: item.artwork }} style={styles.songArtwork} />
				{item.id === currentSong?.id && <MusicVisualizer isPlaying={isPlaying} />}
			</View>
			<ThemedView style={[styles.songInfoContainer, { borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353' }]}>
				<ThemedView style={styles.songInfo}>
					<ThemedText type='defaultSemiBold' numberOfLines={1} style={styles.songTitle}>
						{item.title}
					</ThemedText>
					<ThemedView style={styles.artistRow}>
						{item.id === currentSong?.id && <Ionicons name='musical-note' size={12} color='#FA2D48' />}
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

	return (
		<ThemedView style={styles.container}>
			<ParallaxScrollView
				headerBackgroundColor={{ light: '#f57a8a', dark: '#FA2D48' }}
				headerImage={
					<ThemedView style={{ flex: 1, width: '100%', height: '100%', position: 'absolute' }}>
						<Image
							source={{
								uri: 'https://9to5mac.com/wp-content/uploads/sites/6/2021/08/apple-music-logo-2021-9to5mac.jpg?quality=82&strip=all&w=1024',
							}}
							style={{ position: 'absolute', width: '100%', height: '100%' }}
						/>
						<Text style={{ fontSize: 18, alignSelf: 'center', position: 'absolute', top: 80, color: '#fff' }}>
							Built with Expo
						</Text>
						<View style={styles.headerButtons}>
							<Pressable style={styles.headerButton} onPress={handlePlayFirst}>
								<Ionicons name='play' size={24} color='#fff' />
								<Text style={styles.headerButtonText}>Play</Text>
							</Pressable>
							<Pressable style={styles.headerButton} onPress={handleShuffle}>
								<Ionicons name='shuffle' size={24} color='#fff' />
								<Text style={styles.headerButtonText}>Shuffle</Text>
							</Pressable>
							<Pressable style={styles.headerButton} onPress={pickAndImportSongs}>
								<Ionicons name='folder-open' size={24} color='#fff' />
								<Text style={styles.headerButtonText}>Import</Text>
							</Pressable>
							<Pressable style={styles.headerButton} onPress={deleteAllSongs}>
								<Ionicons name='trash-bin' size={24} color='#fff' />
								<Text style={styles.headerButtonText}>Reset</Text>
							</Pressable>
						</View>
					</ThemedView>
				}
				// @ts-expect-error
				contentContainerStyle={styles.scrollView}
			>
				<ThemedView style={styles.titleContainer}>
					<ThemedView style={styles.titleRow}>
						<ThemedText type='title'>My Local Songs</ThemedText>
					</ThemedView>
					<ThemedText type='subtitle'>{new Date().toLocaleDateString()}</ThemedText>
				</ThemedView>
				<FlatList data={songs} renderItem={renderSongItem} keyExtractor={(item) => item.id.toString()} scrollEnabled={false} />
			</ParallaxScrollView>
		</ThemedView>
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
