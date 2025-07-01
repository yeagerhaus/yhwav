import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { groupBy, map } from 'lodash';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { ThemedText, DynamicItem, ThemedView } from '@/cmps';
import ParallaxScrollView from '@/cmps/ParallaxScrollView';

export default function ArtistDetailScreen() {
	const { artistId } = useLocalSearchParams<{ artistId: string }>();
	const tracks = useLibraryStore((s) => s.tracks); 
	const [albums, setAlbums] = useState<
		{ album: string; songs: typeof tracks }[]
	>([]);

	useEffect(() => {
		if (!artistId || !tracks.length) return;

		const decodedArtist = decodeURIComponent(artistId);
		const filtered = tracks.filter((t) => t.artist?.split(';')[0].trim() === decodedArtist);

		const grouped = groupBy(filtered, 'album');
		const structured = map(grouped, (songs, album) => ({
			album,
			count: songs.length,
			artwork: songs[0]?.artwork, // Add artwork like in AlbumsScreen
			songs: songs.sort((a, b) => {
				const discDiff = (a.discNumber ?? 0) - (b.discNumber ?? 0);
				if (discDiff !== 0) return discDiff;
				return (a.trackNumber ?? 0) - (b.trackNumber ?? 0);
			}),
		}));

		setAlbums(structured);
	}, [artistId, tracks]);


  return (
    <ThemedView style={{ flex: 1}}>
        {/* <ParallaxScrollView
          album
          headerBackgroundColor={{ light: bgColor, dark: bgColor }}
          // @ts-ignore
          headerImage={
          artwork ? (
            <Image
            source={{ uri: artwork }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            />
          ) : undefined
          }
        > */}
      <ThemedText style={styles.header}>{decodeURIComponent(artistId)}</ThemedText>

      <FlatList
			data={albums}
			keyExtractor={(item) => item.album}
			renderItem={({ item }) => <DynamicItem item={item} type="grid" />}
			contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      />
    {/* </ParallaxScrollView> */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, marginHorizontal: 16 },
  albumSection: { marginBottom: 24 },
  albumTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
});
