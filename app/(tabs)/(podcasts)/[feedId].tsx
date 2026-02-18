import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { Div, DynamicItem, Main, Text } from '@/components';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { usePodcastDownloadsStore } from '@/hooks/usePodcastDownloadsStore';
import { usePodcastStore } from '@/hooks/usePodcastStore';
import { toPlayableSong } from '@/types';
import type { PodcastDownload, PodcastEpisode } from '@/types/podcast';
import type { Song } from '@/types/song';

export default function PodcastFeedScreen() {
	const { feedId } = useLocalSearchParams<{ feedId: string }>();
	const colorScheme = useColorScheme();
	const { feeds, episodesByFeedId, fetchFeed, removeFeed } = usePodcastStore();
	const isOffline = useOfflineModeStore((s) => s.offlineMode);
	const getDownloadedEpisodesForFeed = usePodcastDownloadsStore((s) => s.getDownloadedEpisodesForFeed);
	const getLocalUri = usePodcastDownloadsStore((s) => s.getLocalUri);
	const [filterQuery, setFilterQuery] = useState('');

	const feed = useMemo(() => feeds.find((f) => f.id === feedId), [feeds, feedId]);
	const fetchedEpisodes = useMemo(() => (feedId ? episodesByFeedId[feedId] || [] : []), [feedId, episodesByFeedId]);
	const downloadedOnly = useMemo(() => (feedId ? getDownloadedEpisodesForFeed(feedId) : []), [feedId, getDownloadedEpisodesForFeed]);

	// When offline: only downloaded episodes. Otherwise fetched or fallback to downloaded.
	const allEpisodes = useMemo((): (PodcastEpisode | PodcastDownload)[] => {
		if (isOffline) return downloadedOnly;
		return fetchedEpisodes.length > 0 ? fetchedEpisodes : downloadedOnly;
	}, [isOffline, fetchedEpisodes, downloadedOnly]);

	const episodes = useMemo(() => {
		const q = filterQuery.trim().toLowerCase();
		if (!q) return allEpisodes;
		return allEpisodes.filter(
			(ep) =>
				ep.title.toLowerCase().includes(q) ||
				('description' in ep && ep.description?.toLowerCase().includes(q)),
		);
	}, [allEpisodes, filterQuery]);

	useEffect(() => {
		if (feedId && feed && fetchedEpisodes.length === 0) fetchFeed(feedId).catch(() => {});
	}, [feedId, feed, fetchedEpisodes.length, fetchFeed]);

	const showTitle = feed?.title || feed?.url || 'Show';
	const showImageUrl = useMemo(() => feed?.imageUrl || allEpisodes.find((ep) => ep.imageUrl)?.imageUrl, [feed?.imageUrl, allEpisodes]);

	const songs: Song[] = useMemo(
		() =>
			episodes.map((ep) => {
				const localUri = 'localUri' in ep ? ep.localUri : getLocalUri(ep.id);
				return toPlayableSong(ep, showTitle, showImageUrl, localUri);
			}),
		[episodes, showTitle, showImageUrl, getLocalUri],
	);

	const feedMenuItems: ContextMenuItem[] = useMemo(
		() => [
			{
				label: 'Refresh',
				systemImage: 'arrow.clockwise',
				onPress: () => {
					if (feedId) fetchFeed(feedId).catch(() => {});
				},
			},
			{
				label: 'Unsubscribe',
				systemImage: 'minus.circle',
				destructive: true,
				onPress: () => {
					Alert.alert('Unsubscribe', `Remove "${showTitle}" and all its downloaded episodes?`, [
						{ text: 'Cancel', style: 'cancel' },
						{
							text: 'Unsubscribe',
							style: 'destructive',
							onPress: () => {
								if (feedId) removeFeed(feedId);
								router.back();
							},
						},
					]);
				},
			},
		],
		[feedId, showTitle, fetchFeed, removeFeed],
	);

	const keyExtractor = useCallback((item: PodcastEpisode | PodcastDownload) => item.id, []);
	const renderItem = useCallback(
		({ item }: { item: PodcastEpisode | PodcastDownload }) => (
			<DynamicItem
				item={item}
				type='podcastEpisode'
				queue={songs}
				listItem
				showTitle={showTitle}
				showImageUrl={showImageUrl}
				feed={feed}
			/>
		),
		[songs, showTitle, showImageUrl, feed],
	);

	const isDark = colorScheme === 'dark';

	const listHeaderComponent = useMemo(
		() => (
			<Div style={feedStyles.header} transparent>
				{showImageUrl ? (
					<Image
						source={{ uri: showImageUrl }}
						style={feedStyles.artwork}
						resizeMode='contain'
					/>
				) : null}
				<Div style={feedStyles.titleContainer} transparent>
					<Div transparent style={feedStyles.titleRow}>
						<Div transparent style={{ flex: 1 }}>
							<Text type='h2' style={{ marginBottom: 4 }}>
								{showTitle}
							</Text>
							<Text type='body' colorVariant='muted'>
								{allEpisodes.length} episodes
							</Text>
						</Div>
						<ContextMenu items={feedMenuItems} style={feedStyles.menuButton}>
							<SymbolView name='ellipsis' size={18} tintColor={isDark ? '#fff' : '#333'} />
						</ContextMenu>
					</Div>
				</Div>
				<Div
					style={[
						feedStyles.searchContainer,
						{
							backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
							marginBottom: 16,
						},
					]}
					transparent
				>
					<SymbolView name='magnifyingglass' size={16} tintColor={isDark ? '#888' : '#999'} />
					<TextInput
						style={[feedStyles.searchInput, { color: isDark ? '#fff' : '#000' }]}
						placeholder='Filter episodes…'
						placeholderTextColor={isDark ? '#666' : '#999'}
						value={filterQuery}
						onChangeText={setFilterQuery}
						returnKeyType='search'
						clearButtonMode='while-editing'
						autoCorrect={false}
						autoCapitalize='none'
					/>
					{filterQuery.length > 0 && (
						<Pressable onPress={() => setFilterQuery('')} hitSlop={8}>
							<SymbolView name='xmark.circle' size={16} tintColor={isDark ? '#666' : '#999'} />
						</Pressable>
					)}
				</Div>
				{filterQuery.length > 0 && episodes.length !== allEpisodes.length && (
					<Text type='bodyXS' colorVariant='muted' style={{ marginTop: 4 }}>
						{episodes.length} of {allEpisodes.length} episodes
					</Text>
				)}
			</Div>
		),
		[showImageUrl, showTitle, allEpisodes.length, episodes.length, filterQuery, isDark, feedMenuItems],
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
				ListHeaderComponent={listHeaderComponent}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={15}
				updateCellsBatchingPeriod={50}
				keyboardDismissMode='on-drag'
				contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}

const feedStyles = StyleSheet.create({
	header: {
		alignItems: 'center',
		paddingTop: 64,
	},
	artwork: {
		width: '100%',
		maxHeight: 250,
		aspectRatio: 1,
		borderRadius: 8,
	},
	titleContainer: {
		paddingVertical: 16,
		width: '100%',
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	menuButton: {
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: 6,
	},
	searchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
		width: '100%',
	},
	searchInput: {
		flex: 1,
		fontSize: 15,
		paddingVertical: 0,
	},
});
