import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, Image } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { usePodcastStore } from '@/hooks/usePodcastStore';
import { toPlayableSong } from '@/types';
import type { PodcastEpisode } from '@/types/podcast';
import type { Song } from '@/types/song';

const ITEM_HEIGHT = 70;

export default function PodcastFeedScreen() {
	const { feedId } = useLocalSearchParams<{ feedId: string }>();
	const { feeds, episodesByFeedId } = usePodcastStore();

	const feed = useMemo(() => feeds.find((f) => f.id === feedId), [feeds, feedId]);
	const episodes = useMemo(() => (feedId ? episodesByFeedId[feedId] || [] : []), [feedId, episodesByFeedId]);

	const showTitle = feed?.title || feed?.url || 'Show';
	const showImageUrl = useMemo(
		() => feed?.imageUrl || episodes.find((ep) => ep.imageUrl)?.imageUrl,
		[feed?.imageUrl, episodes],
	);

	const songs: Song[] = useMemo(
		() => episodes.map((ep) => toPlayableSong(ep, showTitle, showImageUrl)),
		[episodes, showTitle, showImageUrl],
	);

	const keyExtractor = useCallback((item: PodcastEpisode) => item.id, []);
	const renderItem = useCallback(
		({ item }: { item: PodcastEpisode }) => (
			<DynamicItem
				item={item}
				type="podcastEpisode"
				queue={songs}
				listItem
				showTitle={showTitle}
				showImageUrl={showImageUrl}
			/>
		),
		[songs, showTitle, showImageUrl],
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
