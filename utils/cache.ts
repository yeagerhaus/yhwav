import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import { getIsOfflineMode } from '@/hooks/useOfflineModeStore';
import type { Album, Artist, Playlist, Song } from '@/types';

let useLibraryStore: any;
try {
	useLibraryStore = require('@/hooks/useLibraryStore').useLibraryStore;
} catch {}

const STORAGE_LIBRARY_KEY = 'LIBRARY_STATE';

interface LibraryCachePayload {
	tracks: Song[];
	albums: Album[];
	artists: Artist[];
	playlists: Playlist[];
	recentlyPlayed: Song[];
	lastFetchedAt?: number;
}

function getStore() {
	if (!useLibraryStore) {
		useLibraryStore = require('@/hooks/useLibraryStore').useLibraryStore;
	}
	return useLibraryStore;
}

export async function saveLibraryToCache() {
	try {
		const state = getStore().getState();
		const payload: LibraryCachePayload = {
			tracks: state.tracks,
			albums: state.albums,
			artists: state.artists,
			playlists: state.playlists,
			recentlyPlayed: state.recentlyPlayed,
			lastFetchedAt: Date.now(),
		};
		await AsyncStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(payload));
	} catch (err) {
		console.error('Failed to save library state:', err);
	}
}

export async function loadLibraryFromCache(): Promise<LibraryCachePayload | null> {
	try {
		const raw = await AsyncStorage.getItem(STORAGE_LIBRARY_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw);

		// New format: object with tracks, albums, etc.
		if (parsed?.tracks && Array.isArray(parsed.tracks)) {
			return {
				tracks: parsed.tracks,
				albums: Array.isArray(parsed.albums) ? parsed.albums : [],
				artists: Array.isArray(parsed.artists) ? parsed.artists : [],
				playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
				recentlyPlayed: Array.isArray(parsed.recentlyPlayed) ? parsed.recentlyPlayed : [],
				lastFetchedAt: parsed.lastFetchedAt,
			};
		}

		// Legacy format: plain array of tracks
		if (Array.isArray(parsed)) {
			return { tracks: parsed, albums: [], artists: [], playlists: [], recentlyPlayed: [] };
		}

		return null;
	} catch (err) {
		console.error('Failed to load library state from cache:', err);
		return null;
	}
}

export async function rehydrateLibraryStore(): Promise<boolean> {
	const cached = await loadLibraryFromCache();

	if (!cached || cached.tracks.length === 0) {
		return false;
	}

	const store = getStore();

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
 * Fetch fresh library data from the server, then atomically replace the store
 * and persisted cache. Keeps old data visible until the new data arrives.
 * Returns the number of tracks fetched, or 0 on failure.
 */
export async function clearCacheAndReload(): Promise<number> {
	if (getIsOfflineMode()) {
		return 0;
	}
	const { fetchAllTracks, fetchAllAlbums, fetchAllArtists, fetchAllPlaylists, fetchRecentlyPlayed } = require('@/utils/plex');
	const store = getStore();

	try {
		const [tracks, albums, artists, playlists, recentlyPlayed] = await Promise.all([
			fetchAllTracks(),
			fetchAllAlbums(),
			fetchAllArtists(),
			fetchAllPlaylists(),
			fetchRecentlyPlayed(15),
		]);

		const state = store.getState();
		if (tracks.length > 0) state.setTracks(tracks);
		if (albums.length > 0) state.setAlbums(albums);
		if (artists.length > 0) state.setArtists(artists);
		if (playlists.length > 0) state.setPlaylists(playlists);
		if (recentlyPlayed.length > 0) state.setRecentlyPlayed(recentlyPlayed);

		InteractionManager.runAfterInteractions(() => {
			saveLibraryToCache().catch((err) => console.warn('Cache save failed:', err));
		});

		return tracks.length;
	} catch (err) {
		console.error('Failed to reload library:', err);
		return 0;
	}
}
