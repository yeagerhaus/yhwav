import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Div, DynamicItem, HomeSection, Main, Text } from '@/components';
import { useColors } from '@/hooks/useColors';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';
import { clearCacheAndReload } from '@/utils/cache';

const ITEM_SIZE = 175;
const SECTION_LIMIT = 15;

const SECTIONS = [
	{ title: 'Playlists', icon: 'music.note.list', route: '/(tabs)/(library)/(playlists)' },
	{ title: 'Artists', icon: 'person.2.fill', route: '/(tabs)/(library)/(artists)' },
	{ title: 'Albums', icon: 'square.stack.3d.up.fill', route: '/(tabs)/(library)/(albums)' },
	{ title: 'Songs', icon: 'music.note', route: '/(tabs)/(library)/songs' },
];

export default function LibraryScreen() {
	const colors = useColors();
	const router = useRouter();
	const { tracks, albums, recentlyPlayed, playlists } = useOfflineFilteredLibrary();
	const hasInitialized = useLibraryStore((s) => s.hasInitialized);
	const trackCount = tracks.length;
	const [refreshing, setRefreshing] = useState(false);
	const isLoading = !hasInitialized;
	const isEmpty = hasInitialized && trackCount === 0;

	const recentlyAdded = useMemo(
		() =>
			[...albums]
				.filter((a) => a.addedAt != null)
				.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
				.slice(0, SECTION_LIMIT),
		[albums],
	);

	const recentPlaylists = useMemo(
		() =>
			[...playlists]
				.filter((p) => p.playlistType === 'audio' && p.artworkUrl != null)
				.sort((a, b) => (b.lastViewedAt ?? 0) - (a.lastViewedAt ?? 0))
				.slice(0, SECTION_LIMIT),
		[playlists],
	);

	const limitedRecentlyPlayed = useMemo(() => recentlyPlayed.slice(0, SECTION_LIMIT), [recentlyPlayed]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await clearCacheAndReload();
		setRefreshing(false);
	}, []);

	return (
		<Main refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
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

			{isEmpty ? (
				<Div transparent style={styles.emptyState}>
					<Text type='bodySM' style={styles.emptyText}>
						No library data available
					</Text>
					<Text type='body' style={styles.emptySubtext}>
						Pull to refresh or check your server connection
					</Text>
				</Div>
			) : (
				<Div transparent display='flex' flex={1} gap={16} style={{ paddingBottom: 40 }}>
					<HomeSection
						title='Recently Played'
						data={limitedRecentlyPlayed}
						keyExtractor={(item) => item.id}
						renderItem={(item) => <DynamicItem type='largeSong' item={item} queue={limitedRecentlyPlayed} size={ITEM_SIZE} />}
						isLoading={isLoading}
						itemSize={ITEM_SIZE}
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
						isLoading={isLoading}
						itemSize={ITEM_SIZE}
					/>

					<HomeSection
						title='Recent Playlists'
						data={recentPlaylists}
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
						isLoading={isLoading}
						itemSize={ITEM_SIZE}
					/>
				</Div>
			)}
		</Main>
	);
}

const styles = StyleSheet.create({
	emptyState: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingTop: 60,
		paddingHorizontal: 32,
	},
	emptyText: {
		opacity: 0.5,
		marginBottom: 8,
	},
	emptySubtext: {
		opacity: 0.35,
		textAlign: 'center',
		fontSize: 14,
	},
});
