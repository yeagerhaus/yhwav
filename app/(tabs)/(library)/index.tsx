import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DynamicItem, ThemedText } from '@/cmps';
import ParallaxScrollView from '@/cmps/ParallaxScrollView';
import { ThemedView } from '@/cmps/ThemedView';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { fetchAllTracks, saveLibraryToCache } from '@/utils';

const SECTIONS = [
	{ title: 'Playlists', route: '/(tabs)/(library)/(playlists)' },
	{ title: 'Artists', route: '/(tabs)/(library)/(artists)' },
	{ title: 'Albums', route: '/(tabs)/(library)/(albums)' },
	{ title: 'Songs', route: '/(tabs)/(library)/songs' },
];

export default function LibraryScreen() {
	const router = useRouter();
	const { isLibraryLoading, tracks, setTracks } = useLibraryStore();
	const [isRefreshing, setIsRefreshing] = useState(false);

	console.log('isLibraryLoading:', isLibraryLoading);

	const handleRefresh = async () => {
		setIsRefreshing(true);
		try {
			// Fetch fresh data from Plex
			const fetchedTracks = await fetchAllTracks();

			// Update the store
			await setTracks(fetchedTracks);
			await new Promise((resolve) => setTimeout(resolve, 10)); // allow flush
			await saveLibraryToCache();
		} catch (error) {
			console.error('❌ Failed to refresh library:', error);
		} finally {
			setIsRefreshing(false);
		}
	};

	return (
		<ThemedView style={styles.container}>
			<ParallaxScrollView
				headerBackgroundColor={{ light: '#f57a8a', dark: '#FA2D48' }}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor='#fff'
						title='Pull to refresh library'
						titleColor='#fff'
					/>
				}
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
							{/* <Pressable style={styles.headerButton} onPress={handleImport}>
								<Ionicons name='folder-open' size={24} color='#fff' />
								<Text style={styles.headerButtonText}>Import</Text>
							</Pressable> */}
						</View>
					</ThemedView>
				}
				// @ts-ignore
				contentContainerStyle={styles.scrollView as any}
			>
				<View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
					{isLibraryLoading ? (
						<ActivityIndicator />
					) : (
						<>
							<ThemedText style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
								{tracks.length} {tracks.length === 1 ? 'Song' : 'Songs'} in Library
							</ThemedText>
							<FlatList
								data={SECTIONS}
								keyExtractor={(item) => item.title}
								renderItem={({ item }) => (
									<DynamicItem item={item} type='list' onPress={() => router.push(item.route as any)} />
								)}
							/>
						</>
					)}
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
