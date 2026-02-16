import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import AlbumItem from '@/components/DynamicItem/AlbumItem';
import ArtistItem from '@/components/DynamicItem/ArtistItem';
import HorizontalSongItem from '@/components/DynamicItem/HorizontalSongItem';
import PlaylistItem from '@/components/DynamicItem/PlaylistItem';
import { HomeSection } from '@/components/HomeSection';
import { Main } from '@/components/Main';
import { Colors } from '@/constants';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { clearCacheAndReload } from '@/utils/cache';
import { fetchRecentlyPlayed } from '@/utils/plex';

const ITEM_SIZE = 150;

export default function HomeScreen() {
	const [refreshing, setRefreshing] = useState(false);
	const albums = useLibraryStore((s) => s.albums);
	const artists = useLibraryStore((s) => s.artists);
	const playlists = useLibraryStore((s) => s.playlists);
	const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
	const setRecentlyPlayed = useLibraryStore((s) => s.setRecentlyPlayed);

	const recentlyAdded = useMemo(
		() =>
			[...albums]
				.filter((a) => a.addedAt != null)
				.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
				.slice(0, 25),
		[albums],
	);

	// const mostPlayedArtists = useMemo(
	// 	() =>
	// 		artists
	// 			.filter((a) => a.viewCount != null && a.viewCount > 0)
	// 			.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
	// 			.slice(0, 25),
	// 	[artists],
	// );

	const audioPlaylists = useMemo(() => playlists.filter((p) => p.playlistType === 'audio' && p.artworkUrl != null), [playlists]);

	useEffect(() => {
		fetchRecentlyPlayed(25)
			.then(setRecentlyPlayed)
			.catch((err) => console.warn('Failed to fetch recently played:', err));
	}, [setRecentlyPlayed]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await Promise.all([
			clearCacheAndReload(),
			fetchRecentlyPlayed(25)
				.then(setRecentlyPlayed)
				.catch((err) => console.warn('Failed to fetch recently played:', err)),
		]);
		setRefreshing(false);
	}, [setRecentlyPlayed]);

	return (
		<Main
			refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />}
		>
			<HomeSection
				title='Recently Played'
				data={recentlyPlayed}
				keyExtractor={(item) => item.id}
				renderItem={(item) => <HorizontalSongItem item={item} queue={recentlyPlayed} size={ITEM_SIZE} />}
			/>

			<HomeSection
				title='Recently Added'
				data={recentlyAdded}
				keyExtractor={(item) => item.id}
				renderItem={(item) => (
					<AlbumItem item={{ id: item.id, album: item.title, artwork: item.artwork, artist: item.artist }} size={ITEM_SIZE} />
				)}
			/>

			{/* <HomeSection
				title='Most Played Artists'
				data={mostPlayedArtists}
				keyExtractor={(item) => item.key}
				renderItem={(item) => <ArtistItem item={item} size={ITEM_SIZE} />}
			/> */}

			<HomeSection
				style={{ paddingBottom: 64 }}
				title='Your Playlists'
				data={audioPlaylists}
				keyExtractor={(item) => item.key ?? item.id}
				renderItem={(item) => (
					<PlaylistItem
						item={{
							id: item.key ?? item.id,
							title: item.title,
							artwork: item.artworkUrl ?? '',
							count: item.leafCount ?? 0,
						}}
						size={ITEM_SIZE}
					/>
				)}
			/>
		</Main>
	);
}
