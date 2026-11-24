import { useEffect, useMemo, useState } from 'react';
import { isAvailable, YhwavAudioModule } from '@/modules/yhwav-audio/src';
import type { Album, Artist, Playlist, Song } from '@/types';
import { useOfflineFilteredLibrary } from './useOfflineFilteredLibrary';
import { useSearchStore } from './useSearchStore';

export interface SearchResult {
	type: 'song' | 'album' | 'artist' | 'playlist';
	item: Song | Album | Artist | Playlist;
	score: number;
}

export interface SearchResults {
	songs: SearchResult[];
	albums: SearchResult[];
	artists: SearchResult[];
	playlists: SearchResult[];
	totalResults: number;
}

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}

const EMPTY: SearchResults = { songs: [], albums: [], artists: [], playlists: [], totalResults: 0 };

const useNativeSearch = isAvailable();

/** Cheap content signature (ids + titles) so the native index is only rebuilt when tracks really change. */
function trackSignature(tracks: Song[]): string {
	let h = 2166136261;
	for (const t of tracks) {
		const key = `${t.id}\u0001${t.title}`;
		for (let i = 0; i < key.length; i++) {
			h ^= key.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
	}
	return `${tracks.length}:${h >>> 0}`;
}

/** Score every match (no early exit, so the best prefix matches can't be missed), then keep the top `limit`. */
function topMatches<T>(items: T[], score: (item: T) => number, limit: number, type: SearchResult['type']): SearchResult[] {
	const hits: SearchResult[] = [];
	for (const item of items) {
		const sc = score(item);
		if (sc > 0) hits.push({ type, item: item as SearchResult['item'], score: sc });
	}
	hits.sort((a, b) => b.score - a.score);
	return hits.slice(0, limit);
}

function textScore(text: string, q: string, prefixScore: number, containsScore: number): number {
	if (text.startsWith(q)) return prefixScore;
	return text.includes(q) ? containsScore : 0;
}

let nativeIndexEpoch = 0;
let nativeIndexSignature = '';

export function useSearch() {
	const query = useSearchStore((s) => s.query);
	const [searchResults, setSearchResults] = useState<SearchResults & { query: string }>({ ...EMPTY, query: '' });
	const { tracks, albums, artists, playlists } = useOfflineFilteredLibrary();

	const debouncedQuery = useDebounce(query, 300);

	const tracksById = useMemo(() => {
		if (!useNativeSearch) return null;
		const map = new Map<string, Song>();
		for (const t of tracks) map.set(t.id, t);
		return map;
	}, [tracks]);

	const audioPlaylists = useMemo(() => playlists.filter((p) => p.playlistType === 'audio'), [playlists]);

	// Rebuild the native index only when track content changes (not on every library refresh that yields
	// a new array). Each build carries an epoch; native drops builds older than the newest it has seen.
	useEffect(() => {
		if (!useNativeSearch || !YhwavAudioModule) return;
		const signature = trackSignature(tracks);
		if (signature === nativeIndexSignature) return;
		nativeIndexSignature = signature;
		nativeIndexEpoch += 1;
		const minimal = tracks.map((t) => ({ id: t.id, title: t.title, artist: t.artist, album: t.album }));
		YhwavAudioModule.buildSearchIndex(minimal, nativeIndexEpoch).catch(() => {});
	}, [tracks]);

	useEffect(() => {
		const normalizedQuery = debouncedQuery.toLowerCase().trim();
		if (!normalizedQuery) {
			setSearchResults({ ...EMPTY, query: '' });
			return;
		}

		let cancelled = false;

		const rest = {
			albums: topMatches(
				albums,
				(a) =>
					textScore(a.title.toLowerCase(), normalizedQuery, 100, 50) + textScore(a.artist.toLowerCase(), normalizedQuery, 80, 40),
				10,
				'album',
			),
			artists: topMatches(
				artists,
				(a) =>
					textScore(a.name.toLowerCase(), normalizedQuery, 100, 50) +
					(a.genres.some((g) => g.toLowerCase().includes(normalizedQuery)) ? 30 : 0),
				10,
				'artist',
			),
			playlists: topMatches(audioPlaylists, (p) => textScore(p.title.toLowerCase(), normalizedQuery, 100, 50), 10, 'playlist'),
		};

		const publish = (songs: SearchResult[]) => {
			if (cancelled) return;
			setSearchResults({
				songs,
				...rest,
				totalResults: songs.length + rest.albums.length + rest.artists.length + rest.playlists.length,
				query: debouncedQuery.trim(),
			});
		};

		if (useNativeSearch && YhwavAudioModule && tracksById) {
			YhwavAudioModule.searchTracks(normalizedQuery, 20)
				.then((hits) => {
					const songs: SearchResult[] = [];
					for (const hit of hits) {
						const song = tracksById.get(hit.id);
						if (song) songs.push({ type: 'song', item: song, score: hit.score });
					}
					publish(songs);
				})
				.catch(() => publish([]));
		} else {
			publish(
				topMatches(
					tracks,
					(song) =>
						textScore(song.titleLower || song.title.toLowerCase(), normalizedQuery, 100, 50) +
						textScore(song.artistLower || song.artist.toLowerCase(), normalizedQuery, 80, 40) +
						textScore(song.albumLower || song.album.toLowerCase(), normalizedQuery, 60, 30),
					20,
					'song',
				),
			);
		}

		return () => {
			cancelled = true;
		};
	}, [debouncedQuery, tracks, albums, artists, audioPlaylists, tracksById]);

	// `query` and `isSearching` follow the query the shown results were computed for, so the screen never
	// shows "No results for X" using results from the previous keystroke.
	return {
		query: searchResults.query,
		searchResults,
		isSearching: debouncedQuery.trim().length > 0,
	};
}
