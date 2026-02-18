import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { FlatList, Image } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { usePodcastDownloadsStore } from '@/hooks/usePodcastDownloadsStore';
import { usePodcastStore } from '@/hooks/usePodcastStore';
import { toPlayableSong } from '@/types';
import type { PodcastDownload, PodcastEpisode } from '@/types/podcast';
import type { Song } from '@/types/song';

const ITEM_HEIGHT = 70;

export default function PodcastFeedScreen() {
	const { feedId } = useLocalSearchParams<{ feedId: string }>();
	const { feeds, episodesByFeedId, fetchFeed } = usePodcastStore();
	const getDownloadedEpisodesForFeed = usePodcastDownloadsStore((s) => s.getDownloadedEpisodesForFeed);
	const getLocalUri = usePodcastDownloadsStore((s) => s.getLocalUri);

	const feed = useMemo(() => feeds.find((f) => f.id === feedId), [feeds, feedId]);
	const fetchedEpisodes = useMemo(() => (feedId ? episodesByFeedId[feedId] || [] : []), [feedId, episodesByFeedId]);
	const downloadedOnly = useMemo(() => (feedId ? getDownloadedEpisodesForFeed(feedId) : []), [feedId, getDownloadedEpisodesForFeed]);

	// When offline or fetch failed: show only downloaded episodes for this feed
	const episodes = useMemo(
		(): (PodcastEpisode | PodcastDownload)[] =>
			fetchedEpisodes.length > 0 ? fetchedEpisodes : downloadedOnly,
		[fetchedEpisodes, downloadedOnly],
	);

	// Fetch feed when opening and we don't have episodes yet (so online we get list; offline we'll show downloaded)
	useEffect(() => {
		if (feedId && feed && fetchedEpisodes.length === 0) fetchFeed(feedId).catch(() => {});
	}, [feedId, feed, fetchedEpisodes.length, fetchFeed]);

	const showTitle = feed?.title || feed?.url || 'Show';
	const showImageUrl = useMemo(
		() => feed?.imageUrl || episodes.find((ep) => ep.imageUrl)?.imageUrl,
		[feed?.imageUrl, episodes],
	);

	const songs: Song[] = useMemo(
		() =>
			episodes.map((ep) => {
				const localUri = 'localUri' in ep ? ep.localUri : getLocalUri(ep.id);
				return toPlayableSong(ep, showTitle, showImageUrl, localUri);
			}),
		[episodes, showTitle, showImageUrl, getLocalUri],
	);

	const keyExtractor = useCallback((item: PodcastEpisode | PodcastDownload) => item.id, []);
	const renderItem = useCallback(
		({ item }: { item: PodcastEpisode | PodcastDownload }) => (
			<DynamicItem
				item={item}
				type="podcastEpisode"
				queue={songs}
				listItem
				showTitle={showTitle}
				showImageUrl={showImageUrl}
				feed={feed}
			/>
		),
		[songs, showTitle, showImageUrl, feed],
	);
	const getItemLayout = useCallback(
		(_: unknown, index: number) => ({
			length: ITEM_HEIGHT,
			offset: ITEM_HEIGHT * index,
			index,
		}),
		[],
	);

	const listHeaderComponent = useMemo(
		() => (
			<Div style={{ alignItems: 'center', paddingTop: 64 }} transparent>
				{showImageUrl ? (
					<Image
						source={{ uri: showImageUrl }}
						style={{ width: '100%', maxHeight: 250, aspectRatio: 1, borderRadius: 8 }}
						resizeMode='contain'
					/>
				) : null}
				<Div style={{ paddingVertical: 16, width: '100%' }} transparent>
					<Text type='h2' style={{ marginBottom: 4 }}>
						{showTitle}
					</Text>
					<Text type='body' colorVariant='muted'>
						{episodes.length} episodes
					</Text>
				</Div>
			</Div>
		),
		[showImageUrl, showTitle, episodes.length],
	);

	if (!feed) {
		return (
			<Main>
				<Div transparent style={{ paddingHorizontal: 16, flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 64 }}>
					<Text type='body' colorVariant='muted'>
						Show not found
					</Text>
				</Div>
			</Main>
		);
	}

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={episodes}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				getItemLayout={getItemLayout}
				ListHeaderComponent={listHeaderComponent}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={15}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}
