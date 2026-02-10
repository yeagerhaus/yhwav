import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Song } from '@/types/song';

// Import store directly to avoid circular dependency
let useLibraryStore: any;
try {
	useLibraryStore = require('@/hooks/useLibraryStore').useLibraryStore;
} catch {
	// Fallback if not available
}

const STORAGE_LIBRARY_KEY = 'LIBRARY_STATE';

export interface SerializedLibraryState {
	tracks: Song[];
	songsById: Record<string, Song>;
	albumsById: Record<string, any>;
	artistsByName: Record<string, any>;
}

export async function saveLibraryToCache() {
	try {
		if (!useLibraryStore) {
			useLibraryStore = require('@/hooks/useLibraryStore').useLibraryStore;
		}
		const state = useLibraryStore.getState();
		const serialized: SerializedLibraryState = {
			tracks: state.tracks,
			songsById: state.songsById,
			albumsById: state.albumsById,
			artistsByName: state.artistsByName,
		};

		await AsyncStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(serialized));
	} catch (err) {
		console.error('Failed to save library state:', err);
	}
}

export async function loadLibraryFromCache(): Promise<SerializedLibraryState | null> {
	try {
		const raw = await AsyncStorage.getItem(STORAGE_LIBRARY_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch (err) {
		console.error('Failed to load library state from cache:', err);
		return null;
	}
}

export async function rehydrateLibraryStore(): Promise<boolean> {
	const cached = await loadLibraryFromCache();

	if (!cached) {
		return false;
	}

	if (!useLibraryStore) {
		useLibraryStore = require('@/hooks/useLibraryStore').useLibraryStore;
	}

	// For cached data, set it directly without re-indexing
	// The cache already has all the indexes, so we can use them directly
	// This is MUCH faster than re-indexing
	if (cached.tracks && cached.tracks.length > 0) {
		useLibraryStore.setState({
			tracks: cached.tracks,
			songsById: cached.songsById || {},
			albumsById: cached.albumsById || {},
			artistsByName: cached.artistsByName || {},
			isLibraryIndexing: false,
		});
		return true;
	}
	
	return false;

	return true;
}

export async function clearLibraryCache() {
	try {
		await AsyncStorage.removeItem(STORAGE_LIBRARY_KEY);
	} catch (err) {
		console.error('Failed to clear library cache:', err);
	}
}
