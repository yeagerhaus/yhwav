import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { saveLibraryToCache } from '@/utils/cache';
import { fetchAllAlbums, fetchAllArtists, fetchAllPlaylists, fetchAllTracks, fetchRecentlyPlayed, fetchSectionHubs } from '@/utils/plex';

let refreshPromise: Promise<void> | null = null;
let lastRefreshedAt = 0;

const THROTTLE_MS = 60_000;

async function doRefresh() {
	const { setTracks, setAlbums, setArtists, setPlaylists, setRecentlyPlayed, setHubs } = useLibraryStore.getState();

	// Settle independently so one slow/failed request (e.g. a huge track dump) doesn't drop the rest
	const results = await Promise.allSettled([
		fetchAllTracks(),
		fetchAllAlbums(),
		fetchAllArtists(),
		fetchAllPlaylists(),
		fetchRecentlyPlayed(15),
		fetchSectionHubs(),
	]);
	const labels = ['tracks', 'albums', 'artists', 'playlists', 'recentlyPlayed', 'hubs'];
	const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
	if (failures.length === results.length) throw failures[0].reason;
	results.forEach((r, i) => {
		if (r.status === 'rejected') console.warn(`Library refresh: ${labels[i]} failed:`, r.reason);
	});
	const settledValue = <T>(r: PromiseSettledResult<T>): T | [] => (r.status === 'fulfilled' ? r.value : []);
	const [tracks, albums, artists, playlists, recentlyPlayedSongs, hubs] = [
		settledValue(results[0]),
		settledValue(results[1]),
		settledValue(results[2]),
		settledValue(results[3]),
		settledValue(results[4]),
		settledValue(results[5]),
	];

	if (tracks.length > 0) setTracks(tracks);
	if (albums.length > 0) setAlbums(albums);
	if (artists.length > 0) setArtists(artists);
	if (playlists.length > 0) setPlaylists(playlists);
	if (recentlyPlayedSongs.length > 0) setRecentlyPlayed(recentlyPlayedSongs);
	if (hubs.length > 0) setHubs(hubs);

	lastRefreshedAt = Date.now();

	requestIdleCallback(() => {
		saveLibraryToCache();
	});
}

export async function refreshLibrary(opts?: { force?: boolean }): Promise<void> {
	if (useOfflineModeStore.getState().offlineMode) return;
	if (refreshPromise) return refreshPromise;
	if (!opts?.force && Date.now() - lastRefreshedAt < THROTTLE_MS) return;

	refreshPromise = doRefresh();
	try {
		await refreshPromise;
	} finally {
		refreshPromise = null;
	}
}
