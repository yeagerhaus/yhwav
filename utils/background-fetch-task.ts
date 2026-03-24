import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import type { PodcastEpisode } from '@/types';
import { fetchAndParseFeed } from '@/utils/podcast-rss';

export const BACKGROUND_FETCH_TASK = 'background-episode-and-library-check';

const FEEDS_KEY = 'PODCAST_RSS_FEEDS';
const EPISODES_CACHE_KEY = 'PODCAST_EPISODES_CACHE';
const LIBRARY_CACHE_KEY = 'LIBRARY_STATE';
const AUTH_KEY = 'plex_auth_state';

interface PersistedFeed {
	id: string;
	url: string;
	title?: string;
	imageUrl?: string;
	addedAt: number;
}

async function checkForNewEpisodes(): Promise<boolean> {
	const [feedsRaw, episodesRaw] = await Promise.all([AsyncStorage.getItem(FEEDS_KEY), AsyncStorage.getItem(EPISODES_CACHE_KEY)]);

	if (!feedsRaw) return false;

	const feeds: PersistedFeed[] = JSON.parse(feedsRaw);
	if (feeds.length === 0) return false;

	const cachedEpisodes: Record<string, PodcastEpisode[]> = episodesRaw ? JSON.parse(episodesRaw) : {};

	const cachedIdSets: Record<string, Set<string>> = {};
	for (const [feedId, episodes] of Object.entries(cachedEpisodes)) {
		cachedIdSets[feedId] = new Set(episodes.map((ep) => ep.id));
	}

	let foundNew = false;
	const updatedEpisodes = { ...cachedEpisodes };

	for (const feed of feeds) {
		try {
			const parsed = await fetchAndParseFeed(feed.url, feed.id);
			const cachedIds = cachedIdSets[feed.id] ?? new Set<string>();
			const newEpisodes = parsed.episodes.filter((ep) => !cachedIds.has(ep.id));

			if (newEpisodes.length > 0) {
				foundNew = true;
				const feedTitle = parsed.title ?? feed.title ?? 'Podcast';

				for (const ep of newEpisodes) {
					await Notifications.scheduleNotificationAsync({
						content: {
							title: feedTitle,
							body: ep.title,
							data: { feedId: feed.id, episodeId: ep.id },
							sound: 'default',
						},
						trigger: null,
					});
				}
			}

			updatedEpisodes[feed.id] = parsed.episodes;
		} catch {
			// Skip feeds that fail -- don't block the rest
		}
	}

	await AsyncStorage.setItem(EPISODES_CACHE_KEY, JSON.stringify(updatedEpisodes));
	return foundNew;
}

async function refreshRecentlyPlayed(): Promise<boolean> {
	try {
		const authRaw = await AsyncStorage.getItem(AUTH_KEY);
		if (!authRaw) return false;

		const authState = JSON.parse(authRaw);
		if (!authState?.isAuthenticated || !authState?.accessToken) return false;

		const { plexAuthService } = require('@/utils/plex-auth');
		const loaded = await plexAuthService.loadAuthState();
		if (!loaded) return false;

		const { fetchRecentlyPlayed } = require('@/utils/plex');
		const recentlyPlayed = await fetchRecentlyPlayed(15);

		if (recentlyPlayed.length === 0) return false;

		const cacheRaw = await AsyncStorage.getItem(LIBRARY_CACHE_KEY);
		const cache = cacheRaw ? JSON.parse(cacheRaw) : {};

		cache.recentlyPlayed = recentlyPlayed;
		cache.lastFetchedAt = Date.now();

		await AsyncStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify(cache));
		return true;
	} catch {
		return false;
	}
}

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
	let hasNewData = false;

	try {
		const podcastResult = await checkForNewEpisodes();
		if (podcastResult) hasNewData = true;
	} catch {
		// Podcast check failed, continue to library refresh
	}

	try {
		const libraryResult = await refreshRecentlyPlayed();
		if (libraryResult) hasNewData = true;
	} catch {
		// Library refresh failed
	}

	return hasNewData ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
});

export async function registerBackgroundFetch() {
	const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
	if (isRegistered) return;

	await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
		minimumInterval: 4 * 60 * 60, // 4 hours
		stopOnTerminate: false,
		startOnBoot: false,
	});
}
