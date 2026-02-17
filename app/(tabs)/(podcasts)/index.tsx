import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { Colors } from '@/constants';
import { usePodcastStore } from '@/hooks/usePodcastStore';
import { Ionicons } from '@expo/vector-icons';

type FormattedShow = {
	id: string;
	title: string;
	artwork: string;
	count: number;
};

export default function PodcastsScreen() {
	const { feeds, episodesByFeedId, isLoading, addFeed, fetchAllFeeds } = usePodcastStore();
	const [refreshing, setRefreshing] = useState(false);

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

	const formattedShows: FormattedShow[] = useMemo(
		() =>
			feeds.map((feed) => {
				const episodes = episodesByFeedId[feed.id] || [];
				const episodeArt = episodes.find((ep) => ep.imageUrl)?.imageUrl;
				return {
					id: feed.id,
					title: feed.title || feed.url,
					artwork: feed.imageUrl || episodeArt || '',
					count: episodes.length,
				};
			}),
		[feeds, episodesByFeedId],
	);

	const keyExtractor = useCallback((item: FormattedShow) => item.id, []);
	const renderItem = useCallback(({ item }: { item: FormattedShow }) => <DynamicItem item={item} type='podcast' />, []);

	const listHeaderComponent = useMemo(
		() => (
			<Div transparent style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 64, marginBottom: 16 }}>
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
