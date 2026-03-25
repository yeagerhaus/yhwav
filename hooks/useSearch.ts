import { useEffect, useMemo, useRef, useState } from 'react';
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

export function useSearch() {
	const query = useSearchStore((s) => s.query);
	const [searchResults, setSearchResults] = useState<SearchResults>(EMPTY);
	const { tracks, albums, artists, playlists } = useOfflineFilteredLibrary();

	const debouncedQuery = useDebounce(query, 300);

	const tracksById = useMemo(() => {
		if (!useNativeSearch) return null;
		const map = new Map<string, Song>();
		for (const t of tracks) map.set(t.id, t);
		return map;
	}, [tracks]);

	const indexEpoch = useRef(0);
	useEffect(() => {
		if (!useNativeSearch || !YhwavAudioModule) return;
		indexEpoch.current += 1;
		const minimal = tracks.map((t) => ({ id: t.id, title: t.title, artist: t.artist, album: t.album }));
		YhwavAudioModule.buildSearchIndex(minimal);
	}, [tracks]);

	useEffect(() => {
		if (!debouncedQuery.trim()) {
			setSearchResults(EMPTY);
			return;
		}

		const normalizedQuery = debouncedQuery.toLowerCase().trim();
		if (normalizedQuery.length < 1) {
			setSearchResults(EMPTY);
			return;
		}

		let cancelled = false;

		const searchAlbumsArtistsPlaylists = () => {
			const albumResults: SearchResult[] = [];
			for (const album of albums) {
				const titleLower = album.title.toLowerCase();
				const artistLower = album.artist.toLowerCase();
				const titleMatch = titleLower.includes(normalizedQuery);
				const artistMatch = artistLower.includes(normalizedQuery);
				if (titleMatch || artistMatch) {
					let score = 0;
					if (titleLower.startsWith(normalizedQuery)) score += 100;
					else if (titleMatch) score += 50;
					if (artistLower.startsWith(normalizedQuery)) score += 80;
					else if (artistMatch) score += 40;
					albumResults.push({ type: 'album', item: album, score });
					if (albumResults.length >= 20) break;
				}
			}

			const artistResults: SearchResult[] = [];
			for (const artist of artists) {
				const nameLower = artist.name.toLowerCase();
				const nameMatch = nameLower.includes(normalizedQuery);
				const genreMatch = artist.genres.some((g) => g.toLowerCase().includes(normalizedQuery));
				if (nameMatch || genreMatch) {
					let score = 0;
					if (nameLower.startsWith(normalizedQuery)) score += 100;
					else if (nameMatch) score += 50;
					if (genreMatch) score += 30;
					artistResults.push({ type: 'artist', item: artist, score });
					if (artistResults.length >= 20) break;
				}
			}

			const playlistResults: SearchResult[] = [];
			const audioPlaylists = playlists.filter((p) => p.playlistType === 'audio');
			for (const playlist of audioPlaylists) {
				const titleLower = playlist.title.toLowerCase();
				const titleMatch = titleLower.includes(normalizedQuery);
				if (titleMatch) {
					let score = 0;
					if (titleLower.startsWith(normalizedQuery)) score += 100;
					else score += 50;
					playlistResults.push({ type: 'playlist', item: playlist, score });
					if (playlistResults.length >= 20) break;
				}
			}

			albumResults.sort((a, b) => b.score - a.score);
			artistResults.sort((a, b) => b.score - a.score);
			playlistResults.sort((a, b) => b.score - a.score);

			return {
				albums: albumResults.slice(0, 10),
				artists: artistResults.slice(0, 10),
				playlists: playlistResults.slice(0, 10),
			};
		};

		if (useNativeSearch && YhwavAudioModule && tracksById) {
			const rest = searchAlbumsArtistsPlaylists();
			YhwavAudioModule.searchTracks(normalizedQuery, 20).then((hits) => {
				if (cancelled) return;
				const songs: SearchResult[] = [];
				for (const hit of hits) {
					const song = tracksById.get(hit.id);
					if (song) songs.push({ type: 'song', item: song, score: hit.score });
				}
				const results: SearchResults = {
					songs,
					...rest,
					totalResults: songs.length + rest.albums.length + rest.artists.length + rest.playlists.length,
				};
				setSearchResults(results);
			});
		} else {
			const rest = searchAlbumsArtistsPlaylists();

			const songResults: SearchResult[] = [];
			for (const song of tracks) {
				const titleLower = song.titleLower || song.title.toLowerCase();
				const artistLower = song.artistLower || song.artist.toLowerCase();
				const albumLower = song.albumLower || song.album.toLowerCase();
				const titleMatch = titleLower.includes(normalizedQuery);
				const artistMatch = artistLower.includes(normalizedQuery);
				const albumMatch = albumLower.includes(normalizedQuery);
				if (titleMatch || artistMatch || albumMatch) {
					let score = 0;
					if (titleLower.startsWith(normalizedQuery)) score += 100;
					else if (titleMatch) score += 50;
					if (artistLower.startsWith(normalizedQuery)) score += 80;
					else if (artistMatch) score += 40;
					if (albumLower.startsWith(normalizedQuery)) score += 60;
					else if (albumMatch) score += 30;
					songResults.push({ type: 'song', item: song, score });
					if (songResults.length >= 100) break;
				}
			}
			songResults.sort((a, b) => b.score - a.score);

			const results: SearchResults = {
				songs: songResults.slice(0, 20),
				...rest,
				totalResults: songResults.slice(0, 20).length + rest.albums.length + rest.artists.length + rest.playlists.length,
			};
			setSearchResults(results);
		}

		return () => {
			cancelled = true;
		};
	}, [debouncedQuery, tracks, albums, artists, playlists, tracksById]);

	return {
		query,
		searchResults,
		isSearching: query.length > 0,
	};
}
