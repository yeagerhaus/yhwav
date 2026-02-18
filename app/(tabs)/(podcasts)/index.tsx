import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { Colors } from '@/constants';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { usePodcastDownloadsStore } from '@/hooks/usePodcastDownloadsStore';
import { usePodcastStore } from '@/hooks/usePodcastStore';

type FormattedShow = {
	id: string;
	title: string;
	artwork: string;
	count: number;
};

export default function PodcastsScreen() {
	const { feeds, episodesByFeedId, isLoading, addFeed, fetchAllFeeds } = usePodcastStore();
	const [refreshing, setRefreshing] = useState(false);
	const isOffline = useOfflineModeStore((s) => s.offlineMode);
	const downloads = usePodcastDownloadsStore((s) => s.downloads);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await fetchAllFeeds();
		setRefreshing(false);
	}, [fetchAllFeeds]);

	const handleAddFeed = useCallback(() => {
		if (Platform.OS === 'ios') {
			Alert.prompt(
				'Add Podcast',
				'Enter the RSS feed URL',
				(url) => {
					if (url?.trim()) addFeed(url.trim()).catch(() => {});
				},
				'plain-text',
			);
		} else {
			Alert.alert('Add Podcast', 'Enter the RSS feed URL in the input when supported.');
		}
	}, [addFeed]);

	const formattedShows: FormattedShow[] = useMemo(() => {
		const feedIdsWithDownloads = new Set(Object.values(downloads).map((d) => d.feedId));
		const feedsToShow = isOffline ? feeds.filter((f) => feedIdsWithDownloads.has(f.id)) : feeds;
		return feedsToShow.map((feed) => {
			const episodes = episodesByFeedId[feed.id] || [];
			const downloadedForFeed = isOffline
				? Object.values(downloads).filter((d) => d.feedId === feed.id)
				: null;
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
				<Pressable onPress={handleAddFeed} hitSlop={8}>
					<Ionicons name='add-circle-outline' size={28} color={Colors.brandPrimary} />
				</Pressable>
			</Div>
		),
		[handleAddFeed],
	);

	if (isLoading && feeds.length === 0) {
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
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandPrimary} />}
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
