import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import type { Song } from '@/types';
import { getIsOfflineMode } from '@/hooks/useOfflineModeStore';

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

export async function saveLibraryToCache() {
	try {
		const state = getStore().getState();
		// Only persist tracks — songsById is rebuilt on rehydration
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

	// Build songsById index and backfill lowercase fields
	const songsById: Record<string, Song> = {};
	for (const song of tracks) {
		if (!song?.id) continue;
		if (!song.titleLower) song.titleLower = song.title.toLowerCase();
		if (!song.artistLower) song.artistLower = song.artist.toLowerCase();
		if (!song.albumLower) song.albumLower = song.album.toLowerCase();
		songsById[song.id] = song;
	}

	store.setState({
		tracks,
		songsById,
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
	if (getIsOfflineMode()) {
		return 0;
	}
	const { fetchAllTracks, fetchAllAlbums, fetchAllArtists } = require('@/utils/plex');
	const store = getStore();

	// 1. Wipe persisted cache
	await clearLibraryCache();

	// 2. Reset in-memory state
	store.setState({
		tracks: [],
		songsById: {},
		albums: [],
		albumsById: {},
		artists: [],
		artistsById: {},
	});

	// 3. Fresh fetch from server
	try {
		const [tracks, albums, artists] = await Promise.all([fetchAllTracks(), fetchAllAlbums(), fetchAllArtists()]);

		if (tracks.length > 0) {
			store.getState().setTracks(tracks);
			// Defer cache save so the UI renders before JSON.stringify blocks
			InteractionManager.runAfterInteractions(() => {
				saveLibraryToCache().catch((err) => console.warn('Cache save failed:', err));
			});
		}
		if (albums.length > 0) {
			store.getState().setAlbums(albums);
		}
		if (artists.length > 0) {
			store.getState().setArtists(artists);
		}

		return tracks.length;
	} catch (err) {
		console.error('Failed to reload library:', err);
		return 0;
	}
}
