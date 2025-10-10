import { useEffect, useMemo, useState } from 'react';
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

	useMemo(() => {
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
		console.log('🔍 useSearch useEffect triggered - debouncedQuery:', debouncedQuery);

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

		const results: SearchResults = {
			songs: [],
			albums: [],
			artists: [],
			totalResults: 0,
		};

		// Fast search using simple string matching
		// Search songs - limit to first 1000 for performance
		const songsToSearch = tracks.slice(0, 1000);

		for (const song of songsToSearch) {
			const titleMatch = song.title.toLowerCase().includes(normalizedQuery);
			const artistMatch = song.artist.toLowerCase().includes(normalizedQuery);
			const albumMatch = song.album.toLowerCase().includes(normalizedQuery);

			if (titleMatch || artistMatch || albumMatch) {
				let score = 0;
				if (song.title.toLowerCase().startsWith(normalizedQuery)) score += 100;
				else if (song.title.toLowerCase().includes(normalizedQuery)) score += 50;
				if (song.artist.toLowerCase().startsWith(normalizedQuery)) score += 80;
				else if (song.artist.toLowerCase().includes(normalizedQuery)) score += 40;
				if (song.album.toLowerCase().startsWith(normalizedQuery)) score += 60;
				else if (song.album.toLowerCase().includes(normalizedQuery)) score += 30;

				results.songs.push({
					type: 'song',
					item: song,
					score,
				});
			}
		}

		// Search albums
		for (const album of Object.values(albumsById)) {
			const titleMatch = album.title.toLowerCase().includes(normalizedQuery);
			const artistMatch = album.artist.toLowerCase().includes(normalizedQuery);

			if (titleMatch || artistMatch) {
				let score = 0;
				if (album.title.toLowerCase().startsWith(normalizedQuery)) score += 100;
				else if (album.title.toLowerCase().includes(normalizedQuery)) score += 50;
				if (album.artist.toLowerCase().startsWith(normalizedQuery)) score += 80;
				else if (album.artist.toLowerCase().includes(normalizedQuery)) score += 40;

				results.albums.push({
					type: 'album',
					item: album,
					score,
				});
			}
		}

		// Search artists
		for (const artist of Object.values(artistsByName)) {
			const nameMatch = artist.name.toLowerCase().includes(normalizedQuery);

			if (nameMatch) {
				let score = 0;
				if (artist.name.toLowerCase().startsWith(normalizedQuery)) score += 100;
				else if (artist.name.toLowerCase().includes(normalizedQuery)) score += 50;

				results.artists.push({
					type: 'artist',
					item: artist,
					score,
				});
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

		console.log('🔍 Final results:', {
			songs: results.songs.length,
			albums: results.albums.length,
			artists: results.artists.length,
			total: results.totalResults,
		});

		// Log actual items found
		if (results.songs.length > 0) {
			console.log(
				'🔍 Songs found:',
				results.songs.map((s) => ({
					title: (s.item as Song).title,
					artist: (s.item as Song).artist,
					score: s.score,
				})),
			);
		}
		if (results.albums.length > 0) {
			console.log(
				'🔍 Albums found:',
				results.albums.map((a) => ({
					title: (a.item as Album).title,
					artist: (a.item as Album).artist,
					score: a.score,
				})),
			);
		}
		if (results.artists.length > 0) {
			console.log(
				'🔍 Artists found:',
				results.artists.map((a) => ({
					name: (a.item as Artist).name,
					score: a.score,
				})),
			);
		}

		setSearchResults(results);
	}, [debouncedQuery, tracks, songsById, albumsById, artistsByName]);

	// Force re-render when search results change
	console.log('🔍 useSearch - returning searchResults:', searchResults);

	return {
		query,
		setQuery,
		searchResults,
		isSearching: query.length > 0,
	};
}
