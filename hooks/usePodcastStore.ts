import { create } from 'zustand';
import { getIsOfflineMode } from '@/hooks/useOfflineModeStore';
import { storage } from '@/lib/storage';
import type { PodcastEpisode, PodcastFeed } from '@/types';
import { capEpisodesForCache, fetchAndParseFeed, mapWithConcurrency } from '@/utils/podcast-rss';

const STORAGE_KEY = 'PODCAST_RSS_FEEDS';
const EPISODES_CACHE_KEY = 'PODCAST_EPISODES_CACHE';

interface PersistedFeed {
	id: string;
	url: string;
	title?: string;
	imageUrl?: string;
	addedAt: number;
}

interface PodcastState {
	feeds: PodcastFeed[];
	episodesByFeedId: Record<string, PodcastEpisode[]>;
	isLoading: boolean;
	addingUrl: string | null;
	error: string | null;
	hydrated: boolean;
	lastFetchedAt: number | null;

	addFeed: (url: string) => Promise<void>;
	removeFeed: (id: string) => void;
	fetchFeed: (urlOrId: string) => Promise<void>;
	fetchAllFeeds: () => Promise<void>;
	hydrate: () => void;
	clearError: () => void;
}

function generateFeedId(): string {
	return `feed-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function persistFeeds(feeds: PodcastFeed[]) {
	const toPersist: PersistedFeed[] = feeds.map((f) => ({
		id: f.id,
		url: f.url,
		title: f.title,
		imageUrl: f.imageUrl,
		addedAt: f.addedAt,
	}));
	storage.set(STORAGE_KEY, JSON.stringify(toPersist));
}

function persistEpisodes(episodesByFeedId: Record<string, PodcastEpisode[]>) {
	try {
		const capped: Record<string, PodcastEpisode[]> = {};
		for (const [feedId, episodes] of Object.entries(episodesByFeedId)) capped[feedId] = capEpisodesForCache(episodes);
		storage.set(EPISODES_CACHE_KEY, JSON.stringify(capped));
	} catch {}
}

function loadCachedEpisodes(): Record<string, PodcastEpisode[]> {
	try {
		const raw = storage.getString(EPISODES_CACHE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return typeof parsed === 'object' && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

export const usePodcastStore = create<PodcastState>((set, get) => ({
	feeds: [],
	episodesByFeedId: {},
	isLoading: false,
	addingUrl: null,
	error: null,
	hydrated: false,
	lastFetchedAt: null,

	clearError: () => set({ error: null }),

	hydrate: () => {
		try {
			const raw = storage.getString(STORAGE_KEY);
			const cachedEpisodes = loadCachedEpisodes();
			if (!raw) {
				set({ hydrated: true, episodesByFeedId: cachedEpisodes });
				return;
			}
			const parsed: PersistedFeed[] = JSON.parse(raw);
			const feeds: PodcastFeed[] = parsed.map((p) => ({
				id: p.id,
				url: p.url,
				title: p.title,
				imageUrl: p.imageUrl,
				addedAt: p.addedAt,
			}));
			set({ feeds, episodesByFeedId: cachedEpisodes, hydrated: true });
		} catch {
			set({ hydrated: true });
		}
	},

	addFeed: async (url: string) => {
		const trimmed = url.trim();
		if (!trimmed) return;

		if (getIsOfflineMode()) {
			set({ error: 'Offline mode is on. Disable in Settings to add feeds.' });
			return;
		}

		if (get().feeds.some((f) => f.url === trimmed)) {
			set({ error: 'Feed already added' });
			return;
		}

		set({ addingUrl: trimmed, error: null });
		try {
			const id = generateFeedId();
			const parsed = await fetchAndParseFeed(trimmed, id);
			const newFeed: PodcastFeed = {
				id,
				url: trimmed,
				title: parsed.title,
				imageUrl: parsed.imageUrl,
				addedAt: Date.now(),
			};
			// Merge into the latest state: a refresh may have finished while this feed was being fetched.
			set((s) => ({
				feeds: s.feeds.some((f) => f.url === trimmed) ? s.feeds : [...s.feeds, newFeed],
				episodesByFeedId: { ...s.episodesByFeedId, [id]: parsed.episodes },
				addingUrl: null,
				error: null,
			}));
			persistFeeds(get().feeds);
			persistEpisodes(get().episodesByFeedId);
		} catch (err: any) {
			set({
				addingUrl: null,
				error: err?.message ?? 'Failed to add feed',
			});
			throw err;
		}
	},

	removeFeed: (id: string) => {
		const { feeds, episodesByFeedId } = get();
		const newFeeds = feeds.filter((f) => f.id !== id);
		const newEpisodes = { ...episodesByFeedId };
		delete newEpisodes[id];
		set({ feeds: newFeeds, episodesByFeedId: newEpisodes });
		persistFeeds(newFeeds);
		persistEpisodes(newEpisodes);

		// Don't orphan the feed's downloaded files or progress entries.
		const { usePodcastDownloadsStore } = require('@/hooks/usePodcastDownloadsStore');
		const { usePodcastProgressStore } = require('@/hooks/usePodcastProgressStore');
		const downloadsStore = usePodcastDownloadsStore.getState();
		const feedDownloads = downloadsStore.getDownloadedEpisodesForFeed(id);
		void (async () => {
			// Sequential: removeDownload reads state before awaiting the file delete.
			for (const dl of feedDownloads) {
				await downloadsStore.removeDownload(dl.episodeId).catch(() => {});
			}
		})();
		usePodcastProgressStore.getState().removeProgressForFeed(id);
	},

	fetchFeed: async (urlOrId: string) => {
		if (getIsOfflineMode()) {
			set({ error: 'Offline mode is on.' });
			return;
		}
		const { feeds, episodesByFeedId } = get();
		const feed = feeds.find((f) => f.id === urlOrId || f.url === urlOrId);
		const url = feed?.url ?? urlOrId;
		const id = feed?.id ?? generateFeedId();

		set({ isLoading: true, error: null });
		try {
			const parsed = await fetchAndParseFeed(url, id);
			let newFeeds = feeds;
			if (!feed) {
				const newFeed: PodcastFeed = {
					id,
					url,
					title: parsed.title,
					imageUrl: parsed.imageUrl,
					addedAt: Date.now(),
				};
				newFeeds = [...feeds, newFeed];
				persistFeeds(newFeeds);
				set({ feeds: newFeeds });
			} else {
				const updated = feeds.map((f) => (f.id === id ? { ...f, title: parsed.title, imageUrl: parsed.imageUrl } : f));
				set({ feeds: updated });
				persistFeeds(updated);
			}
			const newEpisodes = { ...episodesByFeedId, [id]: parsed.episodes };
			set({
				episodesByFeedId: newEpisodes,
				isLoading: false,
				error: null,
			});
			persistEpisodes(newEpisodes);
		} catch (err: any) {
			set({
				isLoading: false,
				error: err?.message ?? 'Failed to fetch feed',
			});
		}
	},

	fetchAllFeeds: async () => {
		if (getIsOfflineMode()) return;
		const { feeds } = get();
		if (feeds.length === 0) return;

		set({ isLoading: true, error: null });
		let hadError = false;
		// Fetch feeds in parallel (bounded) and merge each result into the *latest* state, so a feed added
		// or removed while the refresh runs isn't overwritten or resurrected.
		await mapWithConcurrency(feeds, 4, async (feed) => {
			try {
				const parsed = await fetchAndParseFeed(feed.url, feed.id);
				set((s) => {
					if (!s.feeds.some((f) => f.id === feed.id)) return {};
					return {
						feeds: s.feeds.map((f) => (f.id === feed.id ? { ...f, title: parsed.title, imageUrl: parsed.imageUrl } : f)),
						episodesByFeedId: { ...s.episodesByFeedId, [feed.id]: parsed.episodes },
					};
				});
			} catch {
				hadError = true;
			}
		});
		set({
			isLoading: false,
			error: hadError ? 'Some feeds failed to refresh' : null,
			lastFetchedAt: Date.now(),
		});
		persistFeeds(get().feeds);
		persistEpisodes(get().episodesByFeedId);
	},
}));
