import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { getLibraryStorage, storage } from '@/lib/storage';
import type { PodcastEpisode } from '@/types';
import { capEpisodesForCache, fetchAndParseFeed } from '@/utils/podcast-rss';

export const BACKGROUND_FETCH_TASK = 'background-refresh-task';
/** Task name used with the deprecated expo-background-fetch; unregistered on upgrade. */
const LEGACY_BACKGROUND_FETCH_TASK = 'background-episode-and-library-check';
const OFFLINE_MODE_KEY = 'OFFLINE_MODE';

const FEEDS_KEY = 'PODCAST_RSS_FEEDS';
const EPISODES_CACHE_KEY = 'PODCAST_EPISODES_CACHE';
const CACHE_RECENTLY_PLAYED = 'CACHE_RECENTLY_PLAYED';

interface PersistedFeed {
	id: string;
	url: string;
	title?: string;
	imageUrl?: string;
	addedAt: number;
}

async function checkForNewEpisodes(): Promise<boolean> {
	const feedsRaw = storage.getString(FEEDS_KEY);
	const episodesRaw = storage.getString(EPISODES_CACHE_KEY);

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
	// Persist after every feed: the OS can kill a background task mid-run, and anything notified but not
	// recorded as seen would be notified again next time.
	const persistSeen = () => storage.set(EPISODES_CACHE_KEY, JSON.stringify(updatedEpisodes));

	for (const feed of feeds) {
		try {
			const parsed = await fetchAndParseFeed(feed.url, feed.id);
			const cachedIds = cachedIdSets[feed.id];
			// No cache entry yet (e.g. cache was cleared): seed it silently instead of notifying for every
			// episode. Otherwise compare only the newest slice: the cache is capped, so older episodes
			// beyond the cap must not look "new".
			const candidates = capEpisodesForCache(parsed.episodes);
			const newEpisodes = cachedIds ? candidates.filter((ep) => !cachedIds.has(ep.id)) : [];

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

			updatedEpisodes[feed.id] = capEpisodesForCache(parsed.episodes);
			persistSeen();
		} catch {
			// Skip feeds that fail -- don't block the rest
		}
	}

	return foundNew;
}

async function refreshRecentlyPlayed(): Promise<boolean> {
	try {
		// Token lives in the Keychain; loadAuthState reads it (and keeps state if plex.tv is unreachable).
		const { plexAuthService } = require('@/utils/plex-auth');
		const loaded = await plexAuthService.loadAuthState();
		if (!loaded) return false;

		const { fetchRecentlyPlayed } = require('@/utils/plex');
		const recentlyPlayed = await fetchRecentlyPlayed(15);

		if (recentlyPlayed.length === 0) return false;

		const libraryStorage = getLibraryStorage();
		if (!libraryStorage) return false;
		const { mapSongUrls, toStoredPlexUrl } = require('@/utils/plex-url');
		libraryStorage.set(
			CACHE_RECENTLY_PLAYED,
			JSON.stringify(recentlyPlayed.map((s: import('@/types').Song) => mapSongUrls(s, toStoredPlexUrl))),
		);
		return true;
	} catch {
		return false;
	}
}

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
	// Respect offline mode (the store may not be hydrated in a headless launch; read storage directly).
	if (storage.getString(OFFLINE_MODE_KEY) === '1') return BackgroundTask.BackgroundTaskResult.Success;
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

	if (__DEV__ && hasNewData) console.log('Background refresh found new data');
	return BackgroundTask.BackgroundTaskResult.Success;
});

export async function registerBackgroundFetch() {
	// Drop the registration left by the old expo-background-fetch build.
	try {
		if (await TaskManager.isTaskRegisteredAsync(LEGACY_BACKGROUND_FETCH_TASK)) {
			await TaskManager.unregisterTaskAsync(LEGACY_BACKGROUND_FETCH_TASK);
		}
	} catch {}

	const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
	if (isRegistered) return;

	await BackgroundTask.registerTaskAsync(BACKGROUND_FETCH_TASK, {
		minimumInterval: 4 * 60, // minutes
	});
}
