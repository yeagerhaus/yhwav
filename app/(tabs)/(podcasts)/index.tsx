import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { useColors } from '@/hooks/useColors';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { usePodcastDownloadsStore } from '@/hooks/usePodcastDownloadsStore';
import { usePodcastStore } from '@/hooks/usePodcastStore';

const REFRESH_THROTTLE_MS = 60_000;

type FormattedShow = {
	id: string;
	title: string;
	artwork: string;
	count: number;
};

export default function PodcastsScreen() {
	const colors = useColors();
	const { feeds, episodesByFeedId, isLoading, hydrated, addFeed, fetchAllFeeds, lastFetchedAt } = usePodcastStore();
	const [refreshing, setRefreshing] = useState(false);
	const isOffline = useOfflineModeStore((s) => s.offlineMode);
	const downloads = usePodcastDownloadsStore((s) => s.downloads);
	const isBackgroundRefreshing = useRef(false);

	useFocusEffect(
		useCallback(() => {
			if (isOffline || !hydrated || feeds.length === 0 || isBackgroundRefreshing.current) return;
			const elapsed = lastFetchedAt ? Date.now() - lastFetchedAt : Infinity;
			if (elapsed < REFRESH_THROTTLE_MS) return;
			isBackgroundRefreshing.current = true;
			fetchAllFeeds().finally(() => {
				isBackgroundRefreshing.current = false;
			});
		}, [isOffline, hydrated, feeds.length, lastFetchedAt, fetchAllFeeds]),
	);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await fetchAllFeeds();
		setRefreshing(false);
	}, [fetchAllFeeds]);

	const handleAddFeed = useCallback(() => {
		router.push('/(tabs)/(podcasts)/search');
	}, []);

	const handleAddByUrl = useCallback(() => {
		if (Platform.OS === 'ios') {
			Alert.prompt(
				'Add by RSS URL',
				'Enter the podcast RSS feed URL',
				(url) => {
					if (url?.trim()) addFeed(url.trim()).catch(() => {});
				},
				'plain-text',
			);
		} else {
			Alert.alert('Add by RSS URL', 'Enter the RSS feed URL in the input when supported.');
		}
	}, [addFeed]);

	const formattedShows: FormattedShow[] = useMemo(() => {
		const feedIdsWithDownloads = new Set(Object.values(downloads).map((d) => d.feedId));
		const feedsToShow = isOffline ? feeds.filter((f) => feedIdsWithDownloads.has(f.id)) : feeds;
		return feedsToShow.map((feed) => {
			const episodes = episodesByFeedId[feed.id] || [];
			const downloadedForFeed = isOffline ? Object.values(downloads).filter((d) => d.feedId === feed.id) : null;
			const count = isOffline && downloadedForFeed ? downloadedForFeed.length : episodes.length;
			const episodeArt = episodes.find((ep) => ep.imageUrl)?.imageUrl ?? downloadedForFeed?.[0]?.imageUrl;
			return {
				id: feed.id,
				title: feed.title || feed.url,
				artwork: feed.imageUrl || episodeArt || '',
				count,
			};
		});
	}, [feeds, episodesByFeedId, isOffline, downloads]);

	const keyExtractor = useCallback((item: FormattedShow) => item.id, []);
	const renderItem = useCallback(({ item }: { item: FormattedShow }) => <DynamicItem item={item} type='podcast' />, []);

	const listHeaderComponent = useMemo(
		() => (
			<Div
				transparent
				style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 64, marginBottom: 16 }}
			>
				<Text type='h1'>Podcasts</Text>
				<Div transparent style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
					<Pressable onPress={handleAddByUrl} hitSlop={8}>
						<SymbolView name='dot.radiowaves.up.forward' size={22} tintColor={colors.brand} />
					</Pressable>
					<Pressable onPress={handleAddFeed} hitSlop={8}>
						<SymbolView name='plus.circle' size={28} tintColor={colors.brand} />
					</Pressable>
				</Div>
			</Div>
		),
		[handleAddFeed, handleAddByUrl, colors.brand],
	);

	if (!hydrated && isLoading && feeds.length === 0) {
		return (
			<Main>
				<Div transparent style={{ paddingHorizontal: 16, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
					<ActivityIndicator />
				</Div>
			</Main>
		);
	}

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={formattedShows}
				keyExtractor={keyExtractor}
				numColumns={2}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={10}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
				columnWrapperStyle={{ justifyContent: 'space-between' }}
			/>
		</Main>
	);
}
