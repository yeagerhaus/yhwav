import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { DynamicItem, ThemedText, ThemedView } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useAlbums } from '@/hooks/useAlbums';
import { useArtists } from '@/hooks/useArtists';
import type { Album } from '@/types/album';

type AlbumCategory = 'Albums' | 'EPs' | 'Singles' | 'Compilations';

const CATEGORY_ORDER: AlbumCategory[] = ['Albums', 'EPs', 'Singles', 'Compilations'];

function classifyAlbum(album: Album): AlbumCategory {
	if (album.subformat === 'Compilation') return 'Compilations';
	switch (album.format) {
		case 'EP':
			return 'EPs';
		case 'Single':
			return 'Singles';
		default:
			return 'Albums';
	}
}

function sortAlbums(albums: Album[]): Album[] {
	return albums.sort((a, b) => {
		// Sort by release date desc (newest first)
		if (a.originallyAvailableAt && b.originallyAvailableAt) {
			const cmp = b.originallyAvailableAt.localeCompare(a.originallyAvailableAt);
			if (cmp !== 0) return cmp;
		} else if (a.originallyAvailableAt) {
			return -1;
		} else if (b.originallyAvailableAt) {
			return 1;
		}
		// Fallback to year desc
		if (a.year != null && b.year != null) {
			const cmp = b.year - a.year;
			if (cmp !== 0) return cmp;
		} else if (a.year != null) {
			return -1;
		} else if (b.year != null) {
			return 1;
		}
		// Final fallback: title asc
		return a.title.localeCompare(b.title);
	});
}

interface AlbumSection {
	category: AlbumCategory;
	albums: Array<{
		id: string;
		album: string;
		artwork: string;
		artist: string;
		year?: number;
	}>;
}

export default function ArtistDetailScreen() {
	const { artistId } = useLocalSearchParams<{ artistId: string }>();
	const { artistsById } = useArtists();
	const { getAlbumsByArtist } = useAlbums();

	const artist = artistsById[artistId ?? ''];

	const sections = useMemo(() => {
		if (!artist) return [];

		const allAlbums = getAlbumsByArtist(artist.key);

		// Group albums by category
		const grouped = new Map<AlbumCategory, Album[]>();
		for (const album of allAlbums) {
			const category = classifyAlbum(album);
			const list = grouped.get(category);
			if (list) {
				list.push(album);
			} else {
				grouped.set(category, [album]);
			}
		}

		// Build sections in display order, sorting each group
		const result: AlbumSection[] = [];
		for (const category of CATEGORY_ORDER) {
			const albums = grouped.get(category);
			if (!albums || albums.length === 0) continue;

			sortAlbums(albums);

			result.push({
				category,
				albums: albums.map((album) => ({
					id: album.id,
					album: album.title,
					artwork: album.thumb || album.artwork,
					artist: album.artist,
					year: album.year,
				})),
			});
		}

		return result;
	}, [artist, getAlbumsByArtist]);

	if (!artist) {
		return (
			<ThemedView style={styles.container}>
				<ThemedText style={styles.header}>Artist not found</ThemedText>
			</ThemedView>
		);
	}

	return (
		<Main>
			<Div style={{ paddingTop: 64, paddingHorizontal: 16 }}>
				{artist.art && <Image source={{ uri: artist.art }} style={styles.banner} resizeMode='cover' />}
				<Div>
					<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 4 }}>{artist.name}</ThemedText>
					{artist.genres.length > 0 && <ThemedText style={styles.genres}>{artist.genres.join(', ')}</ThemedText>}
					{artist.country && <ThemedText style={styles.country}>{artist.country}</ThemedText>}
				</Div>
				{artist.summary ? (
					<View style={styles.bioContainer}>
						<ThemedText style={styles.bio} numberOfLines={4}>
							{artist.summary}
						</ThemedText>
					</View>
				) : null}
				{sections.map((section) => (
					<View key={section.category}>
						<ThemedText style={styles.sectionHeader}>{section.category}</ThemedText>
						<FlatList
							scrollEnabled={false}
							data={section.albums}
							keyExtractor={(item) => item.id}
							numColumns={2}
							contentContainerStyle={{ paddingBottom: 16 }}
							columnWrapperStyle={{ justifyContent: 'space-between' }}
							renderItem={({ item }) => <DynamicItem item={item} type='album' />}
						/>
					</View>
				))}
				<View style={{ height: 64 }} />
			</Div>
		</Main>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16, marginTop: 100 },
	header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
	banner: { width: '100%', height: 200, borderRadius: 8, marginBottom: 16 },
	genres: { fontSize: 14, color: '#888', marginBottom: 4 },
	country: { fontSize: 14, color: '#888', marginBottom: 16 },
	bioContainer: { marginBottom: 16 },
	bio: { fontSize: 14, color: '#aaa', lineHeight: 20 },
	sectionHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, marginTop: 8 },
});
