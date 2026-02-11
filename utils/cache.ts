import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Album, Artist, Song } from '@/types';

// Import store directly to avoid circular dependency
let useLibraryStore: any;
try {
	useLibraryStore = require('@/hooks/useLibraryStore').useLibraryStore;
} catch {
	// Fallback if not available
}

const STORAGE_LIBRARY_KEY = 'LIBRARY_STATE';

function getStore() {
	if (!useLibraryStore) {
		useLibraryStore = require('@/hooks/useLibraryStore').useLibraryStore;
	}
	return useLibraryStore;
}

/**
 * Build songsById / albumsById / artistsByName indexes from a tracks array.
 * Runs synchronously — fast enough for startup (42k tracks ~50-100ms).
 */
function buildIndexes(tracks: Song[]) {
	const { normalizeArtist } = require('@/utils');

	const songsById: Record<string, Song> = {};
	const albumsById: Record<string, Album> = {};
	const artistsByName: Record<string, Artist> = {};

	for (const song of tracks) {
		if (!song?.id) continue;

		// Backfill lowercase fields for older cached data
		if (!song.titleLower) song.titleLower = song.title.toLowerCase();
		if (!song.artistLower) song.artistLower = song.artist.toLowerCase();
		if (!song.albumLower) song.albumLower = song.album.toLowerCase();

		songsById[song.id] = song;

		const artistKey = normalizeArtist(song.artist || '');
		const albumName = (song.album || '').trim();
		const albumId = albumName ? `${artistKey}-${albumName.toLowerCase()}` : `${artistKey}-unknown`;

		if (albumName && !albumsById[albumId]) {
			albumsById[albumId] = {
				id: albumId,
				title: albumName,
				artist: song.artist || '',
				artistKey,
				artwork: song.artworkUrl || song.artwork || '',
				songIds: [],
			};
		}
		if (albumsById[albumId]) {
			albumsById[albumId].songIds.push(song.id);
		}

		if (!artistsByName[artistKey]) {
			artistsByName[artistKey] = {
				key: artistKey,
				name: song.artist || 'Unknown Artist',
				albumIds: [],
			};
		}
		if (albumId && !artistsByName[artistKey].albumIds.includes(albumId)) {
			artistsByName[artistKey].albumIds.push(albumId);
		}
	}

	return { songsById, albumsById, artistsByName };
}

export async function saveLibraryToCache() {
	try {
		const state = getStore().getState();
		// Only persist tracks — indexes are rebuilt on rehydration
		await AsyncStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(state.tracks));
	} catch (err) {
		console.error('Failed to save library state:', err);
	}
}

export async function loadLibraryFromCache(): Promise<Song[] | null> {
	try {
		const raw = await AsyncStorage.getItem(STORAGE_LIBRARY_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw);
		// Handle both old format (object with tracks field) and new format (plain array)
		if (Array.isArray(parsed)) return parsed;
		if (parsed?.tracks && Array.isArray(parsed.tracks)) return parsed.tracks;
		return null;
	} catch (err) {
		console.error('Failed to load library state from cache:', err);
		return null;
	}
}

export async function rehydrateLibraryStore(): Promise<boolean> {
	const tracks = await loadLibraryFromCache();

	if (!tracks || tracks.length === 0) {
		return false;
	}

	const store = getStore();
	const indexes = buildIndexes(tracks);

	store.setState({
		tracks,
		...indexes,
		isLibraryIndexing: false,
	});

	return true;
}

export async function clearLibraryCache() {
	try {
		await AsyncStorage.removeItem(STORAGE_LIBRARY_KEY);
	} catch (err) {
		console.error('Failed to clear library cache:', err);
	}
}

/**
 * Clear the library cache, reset the in-memory store, and re-fetch from the server.
 * Returns the number of tracks fetched, or 0 on failure.
 */
export async function clearCacheAndReload(): Promise<number> {
	const { fetchAllTracks } = require('@/utils/plex');
	const store = getStore();

	// 1. Wipe persisted cache
	await clearLibraryCache();

	// 2. Reset in-memory state
	store.setState({
		tracks: [],
		songsById: {},
		albumsById: {},
		artistsByName: {},
		isLibraryIndexing: false,
	});

	// 3. Fresh fetch from server
	try {
		const tracks = await fetchAllTracks();
		if (tracks.length > 0) {
			store.getState().setTracks(tracks);
			await saveLibraryToCache();
		}
		return tracks.length;
	} catch (err) {
		console.error('Failed to reload library:', err);
		return 0;
	}
}
