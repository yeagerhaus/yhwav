import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { Div, DynamicItem, HomeSection, Main, Text } from '@/components';
import { Colors } from '@/constants';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';
import { clearCacheAndReload } from '@/utils/cache';
import { fetchRecentlyPlayed } from '@/utils/plex';

const ITEM_SIZE = 175;

const SECTIONS = [
	{ title: 'Playlists', icon: 'music.note.list', route: '/(tabs)/(library)/(playlists)' },
	{ title: 'Artists', icon: 'person.2.fill', route: '/(tabs)/(library)/(artists)' },
	{ title: 'Albums', icon: 'square.stack.3d.up.fill', route: '/(tabs)/(library)/(albums)' },
	{ title: 'Songs', icon: 'music.note', route: '/(tabs)/(library)/songs' },
];

export default function LibraryScreen() {
	const router = useRouter();
	const { tracks, albums, recentlyPlayed, playlists } = useOfflineFilteredLibrary();
	const trackCount = tracks.length;
	const [refreshing, setRefreshing] = useState(false);
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
		<Main refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandPrimary} />}>
			<Div flex={1} style={{ paddingHorizontal: 16, marginBottom: 16 }} transparent>
				<Text type='h3' style={{ marginBottom: 16 }}>
					{Number(trackCount).toLocaleString()} {trackCount === 1 ? 'Song' : 'Songs'} in Library
				</Text>
				<FlatList
					scrollEnabled={false}
					data={SECTIONS}
					keyExtractor={(item) => item.title}
					renderItem={({ item }) => <DynamicItem item={item} type='list' onPress={() => router.push(item.route as any)} />}
				/>
			</Div>
			<Div transparent display='flex' flex={1} gap={16} style={{ paddingBottom: 40 }}>
				<HomeSection
					title='Recently Played'
					data={recentlyPlayed}
					keyExtractor={(item) => item.id}
					renderItem={(item) => <DynamicItem type='largeSong' item={item} queue={recentlyPlayed} size={ITEM_SIZE} />}
				/>

				<HomeSection
					title='Recently Added'
					data={recentlyAdded}
					keyExtractor={(item) => item.id}
					renderItem={(item) => (
						<DynamicItem
							type='album'
							item={{ id: item.id, album: item.title, artwork: item.artwork, artist: item.artist }}
							size={ITEM_SIZE}
						/>
					)}
				/>

				{/* <HomeSection
					title='Most Played Artists'
					data={mostPlayedArtists}
					keyExtractor={(item) => item.key}
					renderItem={(item) => <ArtistItem item={item} size={ITEM_SIZE} />}
				/> */}

				<HomeSection
					title='Your Playlists'
					data={audioPlaylists}
					keyExtractor={(item) => item.key ?? item.id}
					renderItem={(item) => (
						<DynamicItem
							type='playlist'
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
			</Div>
		</Main>
	);
}
