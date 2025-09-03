import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import type { Song } from '@/types/song';

const STORAGE_LIBRARY_KEY = 'LIBRARY_STATE';

export interface SerializedLibraryState {
	tracks: Song[];
	songsById: Record<string, Song>;
	albumsById: Record<string, any>;
	artistsByName: Record<string, any>;
}

export async function saveLibraryToCache() {
	try {
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

	useLibraryStore.setState({
		tracks: cached.tracks,
		songsById: cached.songsById,
		albumsById: cached.albumsById,
		artistsByName: cached.artistsByName,
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
