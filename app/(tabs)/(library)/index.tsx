import { Ionicons } from '@expo/vector-icons';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import ParallaxScrollView from '@/cmps/ParallaxScrollView';
import { ThemedView } from '@/cmps/ThemedView';
import { deleteAllSongs, pickAndImportSongs } from '@/utils';
import { useRouter } from 'expo-router';
import { DynamicItem } from '@/cmps';
import { useLibraryStore } from '@/hooks/useLibraryStore';

const SECTIONS = [
	{ title: 'Playlists', route: '/(tabs)/(library)/(playlists)' },
	{ title: 'Artists', route: '/(tabs)/(library)/(artists)' },
	{ title: 'Albums', route: '/(tabs)/(library)/(albums)' },
	{ title: 'Songs', route: '/(tabs)/(library)/songs' },
];

export default function LibraryScreen() {
	const router = useRouter();

	const handleImport = async () => {
		const importedSongs = await pickAndImportSongs();

		if (importedSongs.length > 0) {
			const currentTracks = useLibraryStore.getState().tracks;
			const updated = [...currentTracks, ...importedSongs];
			useLibraryStore.getState().setTracks(updated);
		}
	};

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
							<Pressable style={styles.headerButton} onPress={handleImport}>
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
				// @ts-ignore
				contentContainerStyle={styles.scrollView as any}
			>
			<View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
				<FlatList
					data={SECTIONS}
					keyExtractor={(item) => item.title}
					renderItem={({ item }) => <DynamicItem item={item} type='list' onPress={() => router.push(item.route as any)} />}
				/>
			</View>
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
