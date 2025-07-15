import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { groupBy, map } from 'lodash';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { ThemedText } from '@/cmps';
import { getArtistInfo } from '@/utils';

type ArtistRow = {
	name: string;
	count: number;
	image?: string;
	genre?: string;
};

export default function ArtistsScreen() {
	const router = useRouter();
	const tracks = useLibraryStore((s) => s.tracks);
	const [artists, setArtists] = useState<ArtistRow[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const grouped = map(
			groupBy(tracks, (t) => t.artist.split(';')[0].trim()),
			(songs, artist) => ({
			name: artist,
			count: songs.length,
			})
		);

		Promise.all(
			grouped.map(async (a) => {
			const info = await getArtistInfo(a.name);
			return {
				...a,
				image: info?.image,
				genre: info?.genre,
			};
			})
		)
		.then((result) => {
		const sorted = result.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
		);
		setArtists(sorted);
		})
		.finally(() => setLoading(false));
	}, [tracks]);

	return (
		<View style={styles.container}>
		{loading ? (
			<ActivityIndicator size="large" color="#FA2D48" />
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
				{/* {item.image && (
					<Image
					source={{ uri: item.image }}
					style={styles.image}
					/>
				)} */}
				<View style={{ flex: 1 }}>
					<ThemedText style={styles.name}>{item.name}</ThemedText>
					{item.genre && <ThemedText style={styles.genre}>{item.genre}</ThemedText>}
					<ThemedText style={styles.count}>{item.count} songs</ThemedText>
				</View>
				</Pressable>
			)}
			/>
		)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16 },
	item: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
	image: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ddd' },
	name: { fontSize: 18, fontWeight: '500' },
	genre: { fontSize: 12, color: '#999' },
	count: { fontSize: 14, color: '#666' },
});