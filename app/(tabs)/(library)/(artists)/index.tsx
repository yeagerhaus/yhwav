import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { normalizeArtist } from '@/utils';

type ArtistRow = {
	name: string;
	count: number;
};

export default function ArtistsScreen() {
	const router = useRouter();
	const tracks = useLibraryStore((s) => s.tracks);
	const [artists, setArtists] = useState<ArtistRow[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Group tracks by artist name (first artist if multiple)
		const grouped = tracks.reduce((acc, track) => {
			const artistName = normalizeArtist(track.artist);
			if (!acc[artistName]) {
				acc[artistName] = [];
			}
			acc[artistName].push(track);
			return acc;
		}, {} as Record<string, typeof tracks>);

		// Transform grouped data into artist rows
		const artistRows = Object.entries(grouped).map(([artist, songs]) => ({
			name: artist,
			count: songs.length,
		}));

		const sorted = artistRows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
		setArtists(sorted);
		setLoading(false);
	}, [tracks]);

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16 }}>
				<Div>
					<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16 }}>Artists</ThemedText>
				</Div>
				{loading ? (
					<ActivityIndicator size='large' color='#FA2D48' />
				) : (
					<FlatList
						data={artists}
						keyExtractor={(item) => item.name}
						renderItem={({ item }) => (
							<Pressable
								style={styles.item}
								// @ts-ignore
								onPress={() => router.push(`(library)/(artists)/${encodeURIComponent(item.name)}`)}
							>
								<View style={{ flex: 1 }}>
									<ThemedText style={styles.name}>{item.name}</ThemedText>
									<ThemedText style={styles.count}>{item.count} songs</ThemedText>
								</View>
							</Pressable>
						)}
						removeClippedSubviews={true}
						maxToRenderPerBatch={10}
						windowSize={10}
						initialNumToRender={15}
						updateCellsBatchingPeriod={50}
					/>
				)}
			</Div>
		</Main>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16 },
	item: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
	image: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ddd' },
	name: { fontSize: 18, fontWeight: '500' },
	count: { fontSize: 14, color: '#666' },
});
