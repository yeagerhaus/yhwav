import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet } from 'react-native';
import { Div, DynamicItem } from '@/components';
import { Main } from '@/components/Main';
import { Text } from '@/components/Text';
import { DefaultSharedComponents } from '@/constants/styles';
import { useArtists } from '@/hooks/useArtists';
import { useColors } from '@/hooks/useColors';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';
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
		if (a.originallyAvailableAt && b.originallyAvailableAt) {
			const cmp = b.originallyAvailableAt.localeCompare(a.originallyAvailableAt);
			if (cmp !== 0) return cmp;
		} else if (a.originallyAvailableAt) {
			return -1;
		} else if (b.originallyAvailableAt) {
			return 1;
		}
		if (a.year != null && b.year != null) {
			const cmp = b.year - a.year;
			if (cmp !== 0) return cmp;
		} else if (a.year != null) {
			return -1;
		} else if (b.year != null) {
			return 1;
		}
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
	const colors = useColors();
	const { artistId } = useLocalSearchParams<{ artistId: string }>();
	const { artistsById } = useArtists();
	const { albums, tracks, artists: offlineArtists } = useOfflineFilteredLibrary();

	const downloads = useMusicDownloadsStore((s) => s.downloads);
	const downloading = useMusicDownloadsStore((s) => s.downloading);
	const queueStore = useMusicDownloadsStore((s) => s.queue);
	const queueTotal = useMusicDownloadsStore((s) => s.queueTotal);
	const queueCompleted = useMusicDownloadsStore((s) => s.queueCompleted);
	const downloadTracks = useMusicDownloadsStore((s) => s.downloadTracks);
	const removeDownloads = useMusicDownloadsStore((s) => s.removeDownloads);
	const downloadedArtists = useMusicDownloadsStore((s) => s.downloadedArtists);
	const downloadedAlbums = useMusicDownloadsStore((s) => s.downloadedAlbums);

	// Prefer full library artist, fall back to persisted snapshot, then offline synthesis
	const artist = artistsById[artistId ?? ''] || downloadedArtists[artistId ?? ''] || offlineArtists.find((a) => a.key === artistId);

	const artistTracks = useMemo(
		() =>
			artist
				? tracks.filter((t) => {
						const normKey = t.artistKey.split('/').pop() || t.artistKey;
						return normKey === artist.key || t.artistKey === artist.key;
					})
				: [],
		[artist, tracks],
	);

	const downloadedCount = useMemo(() => artistTracks.filter((t) => !!downloads[t.id]).length, [artistTracks, downloads]);
	const isFullyDownloaded = artistTracks.length > 0 && downloadedCount === artistTracks.length;
	const isActive = useMemo(
		() => artistTracks.some((s) => downloading.has(s.id) || queueStore.some((q) => q.id === s.id)),
		[artistTracks, downloading, queueStore],
	);

	const handleDownload = useCallback(() => {
		if (isFullyDownloaded) {
			removeDownloads(artistTracks.map((t) => t.id));
		} else {
			downloadTracks(artistTracks);
		}
	}, [isFullyDownloaded, artistTracks, downloadTracks, removeDownloads]);

	const downloadLabel = isActive
		? `Downloading${queueTotal > 0 ? ` ${queueCompleted}/${queueTotal}` : '…'}`
		: isFullyDownloaded
			? 'Remove Download'
			: downloadedCount > 0
				? `Download (${artistTracks.length - downloadedCount} remaining)`
				: `Download (${artistTracks.length} tracks)`;

	const sections = useMemo(() => {
		if (!artist) return [];

		// Try matching albums by artistKey first (normalize Plex paths to ratingKey)
		let allAlbums = albums.filter((a) => {
			const normKey = a.artistKey?.split('/').pop() || a.artistKey;
			return normKey === artist.key || a.artistKey === artist.key;
		});

		// Fallback: also match albums by artist name (handles key format mismatches)
		if (allAlbums.length === 0) {
			allAlbums = albums.filter((a) => a.artist === artist.name);
		}

		// Final fallback: derive album entries from the artist's tracks
		if (allAlbums.length === 0 && artistTracks.length > 0) {
			const albumMap = new Map<string, Album>();
			for (const t of artistTracks) {
				const key = t.album;
				if (key && !albumMap.has(key)) {
					const persisted = Object.values(downloadedAlbums).find((a) => a.title === t.album && a.artist === t.artist);
					albumMap.set(
						key,
						persisted || {
							id: `dl-${encodeURIComponent(t.album)}-${encodeURIComponent(t.artist)}`,
							title: t.album,
							artist: t.artist,
							artistKey: t.artistKey,
							artwork: t.artworkUrl || '',
							thumb: t.artworkUrl,
						},
					);
				}
			}
			allAlbums = Array.from(albumMap.values());
		}

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

		const result: AlbumSection[] = [];
		for (const category of CATEGORY_ORDER) {
			const catAlbums = grouped.get(category);
			if (!catAlbums || catAlbums.length === 0) continue;

			sortAlbums(catAlbums);

			result.push({
				category,
				albums: catAlbums.map((album) => ({
					id: album.id,
					album: album.title,
					artwork: album.thumb || album.artwork,
					artist: album.artist,
					year: album.year,
				})),
			});
		}

		return result;
	}, [artist, albums, artistTracks, downloadedAlbums]);

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
					{artist.genres.length > 0 && (
						<Text style={[styles.genres, { color: colors.textMuted }]}>{artist.genres.join(', ')}</Text>
					)}
					{artist.country && <Text style={[styles.country, { color: colors.textMuted }]}>{artist.country}</Text>}
				</Div>
				{artist.summary ? (
					<Div transparent style={styles.bioContainer}>
						<Text style={[styles.bio, { color: colors.iconMuted }]} numberOfLines={4}>
							{artist.summary}
						</Text>
					</Div>
				) : null}
				{artistTracks.length > 0 && (
					<Pressable onPress={handleDownload} disabled={isActive} style={styles.downloadButton}>
						{isActive ? (
							<ActivityIndicator size='small' color={colors.brand} />
						) : (
							<SymbolView name={isFullyDownloaded ? 'trash' : 'arrow.down.circle'} size={20} tintColor={colors.brand} />
						)}
						<Text type='bodySM' style={{ color: colors.brand }}>
							{downloadLabel}
						</Text>
					</Pressable>
				)}
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
	genres: { fontSize: 14, marginBottom: 4 },
	country: { fontSize: 14, marginBottom: 16 },
	bioContainer: { marginBottom: 16 },
	bio: { fontSize: 14, lineHeight: 20 },
	sectionHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, marginTop: 8 },
	downloadButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginBottom: 16,
		paddingVertical: 8,
	},
});
