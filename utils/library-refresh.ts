import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { getLibraryStorage } from '@/lib/storage';
import { saveLibraryToCache } from '@/utils/cache';
import {
	fetchAllAlbums,
	fetchAllArtists,
	fetchAllPlaylists,
	fetchAllTracks,
	fetchMusicSectionStamp,
	fetchRecentlyPlayed,
	fetchSectionHubs,
} from '@/utils/plex';

let refreshPromise: Promise<void> | null = null;
let lastRefreshedAt = 0;

const THROTTLE_MS = 60_000;
/** Server change stamp of the music section at the time of the last successful full pull. */
const SECTION_STAMP_KEY = 'LIBRARY_SECTION_STAMP';

type Settled<T> = PromiseSettledResult<T>;

async function doRefresh(force: boolean) {
	const { setTracks, setAlbums, setArtists, setPlaylists, setRecentlyPlayed, setHubs } = useLibraryStore.getState();

	// Full section dumps (tracks/albums/artists) are expensive on large libraries. Only re-pull them when
	// the server reports the music section changed (or when forced / nothing is cached yet).
	let stamp: string | null = null;
	try {
		stamp = await fetchMusicSectionStamp();
	} catch (error) {
		console.warn('Library refresh: section stamp check failed:', error);
	}
	const hasLibrary = useLibraryStore.getState().tracks.length > 0;
	const storedStamp = getLibraryStorage()?.getString(SECTION_STAMP_KEY);
	const needsFullPull = force || !hasLibrary || stamp == null || stamp !== storedStamp;

	const heavy: Promise<Settled<unknown>[]> = needsFullPull
		? Promise.allSettled([fetchAllTracks(), fetchAllAlbums(), fetchAllArtists()])
		: Promise.resolve([]);
	// Playlists, play history and hubs change independently of the section stamp — always refresh them.
	const light = Promise.allSettled([fetchAllPlaylists(), fetchRecentlyPlayed(15), fetchSectionHubs()]);

	const [heavyResults, lightResults] = await Promise.all([heavy, light]);
	const results = [...heavyResults, ...lightResults];
	const labels = [...(needsFullPull ? ['tracks', 'albums', 'artists'] : []), 'playlists', 'recentlyPlayed', 'hubs'];

	const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
	if (failures.length === results.length) throw failures[0].reason;
	results.forEach((r, i) => {
		if (r.status === 'rejected') console.warn(`Library refresh: ${labels[i]} failed:`, r.reason);
	});

	// Apply every result that *succeeded*, including empty ones, so server-side deletions (an emptied
	// section or playlist list) propagate. Failed requests leave the existing data untouched.
	const apply = <T>(r: Settled<unknown> | undefined, setter: (value: T) => void) => {
		if (r?.status === 'fulfilled') setter(r.value as T);
	};
	if (needsFullPull) {
		apply(heavyResults[0], setTracks);
		apply(heavyResults[1], setAlbums);
		apply(heavyResults[2], setArtists);
		const heavyOk = heavyResults.every((r) => r.status === 'fulfilled');
		if (heavyOk && stamp != null) getLibraryStorage()?.set(SECTION_STAMP_KEY, stamp);
	}
	apply(lightResults[0], setPlaylists);
	apply(lightResults[1], setRecentlyPlayed);
	apply(lightResults[2], setHubs);

	lastRefreshedAt = Date.now();

	requestIdleCallback(() => {
		saveLibraryToCache();
	});
}

export async function refreshLibrary(opts?: { force?: boolean }): Promise<void> {
	if (useOfflineModeStore.getState().offlineMode) return;
	if (refreshPromise) return refreshPromise;
	if (!opts?.force && Date.now() - lastRefreshedAt < THROTTLE_MS) return;

	refreshPromise = doRefresh(!!opts?.force);
	try {
		await refreshPromise;
	} finally {
		refreshPromise = null;
	}
}
