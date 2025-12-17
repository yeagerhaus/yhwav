import { useEffect, useState } from 'react';
import type { Album, Artist, Song } from '@/types';
import { useLibraryStore } from './useLibraryStore';

export interface SearchResult {
	type: 'song' | 'album' | 'artist';
	item: Song | Album | Artist;
	score: number;
}

export interface SearchResults {
	songs: SearchResult[];
	albums: SearchResult[];
	artists: SearchResult[];
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
	const [query, setQuery] = useState('');
	const [searchResults, setSearchResults] = useState<SearchResults>({
		songs: [],
		albums: [],
		artists: [],
		totalResults: 0,
	});
	const { tracks, songsById, albumsById, artistsByName } = useLibraryStore();

	// Debounce the query to avoid searching on every keystroke
	const debouncedQuery = useDebounce(query, 300);

	useEffect(() => {
		if (!debouncedQuery.trim()) {
			setSearchResults({
				songs: [],
				albums: [],
				artists: [],
				totalResults: 0,
			});
			return;
		}

		const normalizedQuery = debouncedQuery.toLowerCase().trim();
		const queryLength = normalizedQuery.length;

		// Early exit for very short queries
		if (queryLength < 1) {
			setSearchResults({
				songs: [],
				albums: [],
				artists: [],
				totalResults: 0,
			});
			return;
		}

		const results: SearchResults = {
			songs: [],
			albums: [],
			artists: [],
			totalResults: 0,
		};

		// Optimized search with early termination and pre-normalized strings
		// Search songs - increased limit and better performance
		const MAX_SONG_RESULTS = 50; // Increased from 20 to allow better matching
		const songsToSearch = tracks; // Search all tracks, but limit results

		for (const song of songsToSearch) {
			// Pre-normalize once
			const titleLower = song.title.toLowerCase();
			const artistLower = song.artist.toLowerCase();
			const albumLower = song.album.toLowerCase();

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

				// Early termination if we have enough high-scoring results
				if (results.songs.length >= MAX_SONG_RESULTS * 2) {
					break;
				}
			}
		}

		// Search albums - optimized
		const MAX_ALBUM_RESULTS = 10;
		for (const album of Object.values(albumsById)) {
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

		// Search artists - optimized
		const MAX_ARTIST_RESULTS = 10;
		for (const artist of Object.values(artistsByName)) {
			const nameLower = artist.name.toLowerCase();
			const nameMatch = nameLower.includes(normalizedQuery);

			if (nameMatch) {
				let score = 0;
				if (nameLower.startsWith(normalizedQuery)) score += 100;
				else if (nameMatch) score += 50;

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

		// Sort results by score (highest first)
		results.songs.sort((a, b) => b.score - a.score);
		results.albums.sort((a, b) => b.score - a.score);
		results.artists.sort((a, b) => b.score - a.score);

		// Limit results
		results.songs = results.songs.slice(0, 20);
		results.albums = results.albums.slice(0, 10);
		results.artists = results.artists.slice(0, 10);

		results.totalResults = results.songs.length + results.albums.length + results.artists.length;

		setSearchResults(results);
	}, [debouncedQuery, tracks, songsById, albumsById, artistsByName]);

	return {
		query,
		setQuery,
		searchResults,
		isSearching: query.length > 0,
	};
}
