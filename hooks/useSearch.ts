import { useEffect, useState } from 'react';
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

// Debounce hook
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

export function useSearch() {
	const query = useSearchStore((s) => s.query);
	const [searchResults, setSearchResults] = useState<SearchResults>({
		songs: [],
		albums: [],
		artists: [],
		playlists: [],
		totalResults: 0,
	});
	const { tracks, albums, artists, playlists } = useOfflineFilteredLibrary();

	// Debounce the query to avoid searching on every keystroke
	const debouncedQuery = useDebounce(query, 300);

	useEffect(() => {
		const empty: SearchResults = { songs: [], albums: [], artists: [], playlists: [], totalResults: 0 };

		if (!debouncedQuery.trim()) {
			setSearchResults(empty);
			return;
		}

		const normalizedQuery = debouncedQuery.toLowerCase().trim();
		const queryLength = normalizedQuery.length;

		// Early exit for very short queries
		if (queryLength < 1) {
			setSearchResults(empty);
			return;
		}

		const results: SearchResults = { ...empty };

		// Search songs using pre-computed lowercase fields (zero allocations per iteration)
		const MAX_SONG_RESULTS = 50;

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

				results.songs.push({
					type: 'song',
					item: song,
					score,
				});

				if (results.songs.length >= MAX_SONG_RESULTS * 2) {
					break;
				}
			}
		}

		// Search albums
		const MAX_ALBUM_RESULTS = 10;
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

				results.albums.push({
					type: 'album',
					item: album,
					score,
				});

				if (results.albums.length >= MAX_ALBUM_RESULTS * 2) {
					break;
				}
			}
		}

		// Search artists (including genres)
		const MAX_ARTIST_RESULTS = 10;
		for (const artist of artists) {
			const nameLower = artist.name.toLowerCase();
			const nameMatch = nameLower.includes(normalizedQuery);
			const genreMatch = artist.genres.some((g) => g.toLowerCase().includes(normalizedQuery));

			if (nameMatch || genreMatch) {
				let score = 0;
				if (nameLower.startsWith(normalizedQuery)) score += 100;
				else if (nameMatch) score += 50;
				if (genreMatch) score += 30;

				results.artists.push({
					type: 'artist',
					item: artist,
					score,
				});

				if (results.artists.length >= MAX_ARTIST_RESULTS * 2) {
					break;
				}
			}
		}

		// Search playlists
		const MAX_PLAYLIST_RESULTS = 10;
		const audioPlaylists = playlists.filter((p) => p.playlistType === 'audio');
		for (const playlist of audioPlaylists) {
			const titleLower = playlist.title.toLowerCase();
			const titleMatch = titleLower.includes(normalizedQuery);

			if (titleMatch) {
				let score = 0;
				if (titleLower.startsWith(normalizedQuery)) score += 100;
				else score += 50;

				results.playlists.push({
					type: 'playlist',
					item: playlist,
					score,
				});

				if (results.playlists.length >= MAX_PLAYLIST_RESULTS * 2) {
					break;
				}
			}
		}

		// Sort results by score (highest first)
		results.songs.sort((a, b) => b.score - a.score);
		results.albums.sort((a, b) => b.score - a.score);
		results.artists.sort((a, b) => b.score - a.score);
		results.playlists.sort((a, b) => b.score - a.score);

		// Limit results
		results.songs = results.songs.slice(0, 20);
		results.albums = results.albums.slice(0, 10);
		results.artists = results.artists.slice(0, 10);
		results.playlists = results.playlists.slice(0, 10);

		results.totalResults = results.songs.length + results.albums.length + results.artists.length + results.playlists.length;

		setSearchResults(results);
	}, [debouncedQuery, tracks, albums, artists, playlists]);

	return {
		query,
		searchResults,
		isSearching: query.length > 0,
	};
}
