import { getIsOfflineMode } from '@/hooks/useOfflineModeStore';
import { storage as defaultStorage, getLibraryStorage } from '@/lib/storage';
import type { Album, Artist, HomeHub, Playlist, Song } from '@/types';
import {
	mapAlbumUrls,
	mapArtistUrls,
	mapHubUrls,
	mapPlaylistUrls,
	mapSongUrls,
	resolverForCurrentConnection,
	toStoredPlexUrl,
} from '@/utils/plex-url';

let useLibraryStore: any;
try {
	useLibraryStore = require('@/hooks/useLibraryStore').useLibraryStore;
} catch {}

const CACHE_TRACKS = 'CACHE_TRACKS';
const CACHE_ALBUMS = 'CACHE_ALBUMS';
const CACHE_ARTISTS = 'CACHE_ARTISTS';
const CACHE_PLAYLISTS = 'CACHE_PLAYLISTS';
const CACHE_RECENTLY_PLAYED = 'CACHE_RECENTLY_PLAYED';
const CACHE_HUBS = 'CACHE_HUBS';
const CACHE_LAST_FETCHED = 'CACHE_LAST_FETCHED';
const LEGACY_LIBRARY_KEY = 'LIBRARY_STATE';
const SPLIT_KEYS = [CACHE_TRACKS, CACHE_ALBUMS, CACHE_ARTISTS, CACHE_PLAYLISTS, CACHE_RECENTLY_PLAYED, CACHE_HUBS, CACHE_LAST_FETCHED];

let migrated = false;

/**
 * The library cache lives in its own encrypted MMKV instance. On first use, move any cache keys that an
 * older build wrote into the default instance, then delete them there.
 */
function cacheStorage() {
	const store = getLibraryStorage();
	if (store && !migrated) {
		migrated = true;
		for (const key of [...SPLIT_KEYS, LEGACY_LIBRARY_KEY]) {
			const value = defaultStorage.getString(key);
			if (value != null) {
				if (!store.contains(key)) store.set(key, value);
				defaultStorage.remove(key);
			}
		}
	}
	return store;
}

interface LibraryCachePayload {
	tracks: Song[];
	albums: Album[];
	artists: Artist[];
	playlists: Playlist[];
	recentlyPlayed: Song[];
	hubs: HomeHub[];
	lastFetchedAt?: number;
}

function getStore() {
	if (!useLibraryStore) {
		useLibraryStore = require('@/hooks/useLibraryStore').useLibraryStore;
	}
	return useLibraryStore;
}

export function saveLibraryToCache() {
	try {
		const storage = cacheStorage();
		if (!storage) return;
		const state = getStore().getState();
		// Persist host- and token-free URLs (plex:/path); they are re-resolved on load.
		const strip = toStoredPlexUrl;
		storage.set(CACHE_TRACKS, JSON.stringify(state.tracks.map((s: Song) => mapSongUrls(s, strip))));
		storage.set(CACHE_ALBUMS, JSON.stringify(state.albums.map((a: Album) => mapAlbumUrls(a, strip))));
		storage.set(CACHE_ARTISTS, JSON.stringify(state.artists.map((a: Artist) => mapArtistUrls(a, strip))));
		storage.set(CACHE_PLAYLISTS, JSON.stringify(state.playlists.map((p: Playlist) => mapPlaylistUrls(p, strip))));
		storage.set(CACHE_RECENTLY_PLAYED, JSON.stringify(state.recentlyPlayed.map((s: Song) => mapSongUrls(s, strip))));
		storage.set(CACHE_HUBS, JSON.stringify(state.hubs.map((h: HomeHub) => mapHubUrls(h, strip))));
		storage.set(CACHE_LAST_FETCHED, String(Date.now()));
	} catch (err) {
		console.error('Failed to save library state:', err);
	}
}

export function loadLibraryFromCache(): LibraryCachePayload | null {
	try {
		const storage = cacheStorage();
		if (!storage) return null;
		const tracksRaw = storage.getString(CACHE_TRACKS);

		if (tracksRaw) {
			const tracks = JSON.parse(tracksRaw);
			if (Array.isArray(tracks)) {
				const albumsRaw = storage.getString(CACHE_ALBUMS);
				const artistsRaw = storage.getString(CACHE_ARTISTS);
				const playlistsRaw = storage.getString(CACHE_PLAYLISTS);
				const recentlyPlayedRaw = storage.getString(CACHE_RECENTLY_PLAYED);
				const hubsRaw = storage.getString(CACHE_HUBS);
				const lastFetchedRaw = storage.getString(CACHE_LAST_FETCHED);
				return {
					tracks,
					albums: albumsRaw ? JSON.parse(albumsRaw) : [],
					artists: artistsRaw ? JSON.parse(artistsRaw) : [],
					playlists: playlistsRaw ? JSON.parse(playlistsRaw) : [],
					recentlyPlayed: recentlyPlayedRaw ? JSON.parse(recentlyPlayedRaw) : [],
					hubs: hubsRaw ? JSON.parse(hubsRaw) : [],
					lastFetchedAt: lastFetchedRaw ? Number(lastFetchedRaw) : undefined,
				};
			}
		}

		// Migrate from legacy single-key format (AsyncStorage or old MMKV)
		const legacyRaw = storage.getString(LEGACY_LIBRARY_KEY);
		if (legacyRaw) {
			const parsed = JSON.parse(legacyRaw);
			storage.remove(LEGACY_LIBRARY_KEY);

			if (parsed?.tracks && Array.isArray(parsed.tracks)) {
				const payload: LibraryCachePayload = {
					tracks: parsed.tracks,
					albums: Array.isArray(parsed.albums) ? parsed.albums : [],
					artists: Array.isArray(parsed.artists) ? parsed.artists : [],
					playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
					recentlyPlayed: Array.isArray(parsed.recentlyPlayed) ? parsed.recentlyPlayed : [],
					hubs: Array.isArray(parsed.hubs) ? parsed.hubs : [],
					lastFetchedAt: parsed.lastFetchedAt,
				};
				// Re-save in split format
				storage.set(CACHE_TRACKS, JSON.stringify(payload.tracks));
				storage.set(CACHE_ALBUMS, JSON.stringify(payload.albums));
				storage.set(CACHE_ARTISTS, JSON.stringify(payload.artists));
				storage.set(CACHE_PLAYLISTS, JSON.stringify(payload.playlists));
				storage.set(CACHE_RECENTLY_PLAYED, JSON.stringify(payload.recentlyPlayed));
				return payload;
			}

			if (Array.isArray(parsed)) {
				const payload: LibraryCachePayload = {
					tracks: parsed,
					albums: [],
					artists: [],
					playlists: [],
					recentlyPlayed: [],
					hubs: [],
				};
				storage.set(CACHE_TRACKS, JSON.stringify(parsed));
				return payload;
			}
		}

		return null;
	} catch (err) {
		console.error('Failed to load library state from cache:', err);
		return null;
	}
}

export function rehydrateLibraryStore(): boolean {
	const cached = loadLibraryFromCache();

	if (!cached || cached.tracks.length === 0) {
		return false;
	}

	const store = getStore();

	// Resolve stored plex:/ URLs against the current connection. Legacy caches stored full URLs with an
	// old host/token: normalizing through toStoredPlexUrl first re-bases those too.
	const resolveStored = resolverForCurrentConnection();
	const resolve = (url: string | undefined) => resolveStored(toStoredPlexUrl(url));
	cached.tracks = cached.tracks.map((s) => mapSongUrls(s, resolve));
	cached.albums = cached.albums.map((a) => mapAlbumUrls(a, resolve));
	cached.artists = cached.artists.map((a) => mapArtistUrls(a, resolve));
	cached.playlists = cached.playlists.map((p) => mapPlaylistUrls(p, resolve));
	cached.recentlyPlayed = cached.recentlyPlayed.map((s) => mapSongUrls(s, resolve));
	cached.hubs = (cached.hubs ?? []).map((h) => mapHubUrls(h, resolve));

	const songsById: Record<string, Song> = {};
	for (const song of cached.tracks) {
		if (!song?.id) continue;
		if (!song.titleLower) song.titleLower = song.title.toLowerCase();
		if (!song.artistLower) song.artistLower = song.artist.toLowerCase();
		if (!song.albumLower) song.albumLower = song.album.toLowerCase();
		songsById[song.id] = song;
	}

	const albumsById: Record<string, Album> = {};
	for (const album of cached.albums) {
		if (album?.id) albumsById[album.id] = album;
	}

	const artistsById: Record<string, Artist> = {};
	for (const artist of cached.artists) {
		if (artist?.key) artistsById[artist.key] = artist;
	}

	const playlistsById: Record<string, Playlist> = {};
	for (const playlist of cached.playlists) {
		if (playlist?.id) playlistsById[playlist.id] = playlist;
	}

	store.setState({
		tracks: cached.tracks,
		songsById,
		albums: cached.albums,
		albumsById,
		artists: cached.artists,
		artistsById,
		playlists: cached.playlists,
		playlistsById,
		recentlyPlayed: cached.recentlyPlayed,
		hubs: cached.hubs ?? [],
	});

	return true;
}

export function clearLibraryCache() {
	try {
		cacheStorage()?.clearAll();
		for (const key of [...SPLIT_KEYS, LEGACY_LIBRARY_KEY]) defaultStorage.remove(key);
	} catch (err) {
		console.error('Failed to clear library cache:', err);
	}
}

/**
 * Fetch fresh library data from the server, then atomically replace the store
 * and persisted cache. Keeps old data visible until the new data arrives.
 * Returns the number of tracks fetched, or 0 on failure.
 */
export async function clearCacheAndReload(): Promise<number> {
	if (getIsOfflineMode()) {
		return 0;
	}
	// Lazy require: library-refresh imports this module
	const { refreshLibrary } = require('@/utils/library-refresh');

	try {
		await refreshLibrary({ force: true });
		return getStore().getState().tracks.length;
	} catch (err) {
		console.error('Failed to reload library:', err);
		return 0;
	}
}
