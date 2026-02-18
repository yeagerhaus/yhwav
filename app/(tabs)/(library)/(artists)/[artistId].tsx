import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Image, StyleSheet } from 'react-native';
import { Div, DynamicItem } from '@/components';
import { Main } from '@/components/Main';
import { Text } from '@/components/Text';
import { Colors, DefaultSharedComponents } from '@/constants/styles';
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
			<Div transparent style={styles.container}>
				<Text style={styles.header}>Artist not found</Text>
			</Div>
		);
	}

	return (
		<Main>
			<Div transparent style={{ paddingTop: 24, paddingHorizontal: 16 }}>
				{artist.art && <Image source={{ uri: artist.art }} style={styles.banner} resizeMode='cover' />}
				<Div transparent>
					<Text type='h1' style={{ marginBottom: 4 }}>
						{artist.name}
					</Text>
					{artist.genres.length > 0 && <Text style={styles.genres}>{artist.genres.join(', ')}</Text>}
					{artist.country && <Text style={styles.country}>{artist.country}</Text>}
				</Div>
				{artist.summary ? (
					<Div transparent style={styles.bioContainer}>
						<Text style={styles.bio} numberOfLines={4}>
							{artist.summary}
						</Text>
					</Div>
				) : null}
				{sections.map((section) => (
					<Div key={section.category} transparent>
						<Text style={styles.sectionHeader}>{section.category}</Text>
						<FlatList
							scrollEnabled={false}
							data={section.albums}
							keyExtractor={(item) => item.id}
							numColumns={2}
							contentContainerStyle={{ paddingBottom: 16 }}
							columnWrapperStyle={{ justifyContent: 'space-between' }}
							renderItem={({ item }) => <DynamicItem item={item} type='album' />}
						/>
					</Div>
				))}
				<Div transparent style={{ height: 64 }} />
			</Div>
		</Main>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16, marginTop: 100 },
	header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
	banner: { width: '100%', height: 200, borderRadius: DefaultSharedComponents.borderRadiusSM, marginBottom: 16 },
	genres: { fontSize: 14, color: Colors.textMuted, marginBottom: 4 },
	country: { fontSize: 14, color: Colors.textMuted, marginBottom: 16 },
	bioContainer: { marginBottom: 16 },
	bio: { fontSize: 14, color: Colors.gray400, lineHeight: 20 },
	sectionHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, marginTop: 8 },
});
