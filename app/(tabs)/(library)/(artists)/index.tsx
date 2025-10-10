import { useRouter } from 'expo-router';
import { groupBy, map } from 'lodash';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/cmps';
import { Div } from '@/cmps/Div';
import { Main } from '@/cmps/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';

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
		const grouped = map(
			groupBy(tracks, (t: any) => t.artist.split(';')[0].trim()),
			(songs: any, artist: any) => ({
				name: artist,
				count: songs.length,
			}),
		);

		const sorted = grouped.sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
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
						scrollEnabled={false}
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
