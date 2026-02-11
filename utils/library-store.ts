/**
 * External library store - outside React state for better performance
 * This allows us to store 42k+ items without triggering React re-renders
 *
 * Key benefits:
 * - No React state overhead
 * - Can store unlimited items
 * - Direct access without re-renders
 * - Manual subscription control
 */

import type { Song } from '@/types';

class LibraryStore {
	private tracks: Song[] = [];
	private songsById: Record<string, Song> = {};
	private listeners: Set<() => void> = new Set();

	// Subscribe to changes (for React components that need updates)
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	// Notify all listeners (only when UI needs to update)
	private notify(): void {
		this.listeners.forEach((listener) => listener());
	}

	// Get all tracks (direct reference, no copy)
	getTracks(): Song[] {
		return this.tracks;
	}

	// Get track by ID (O(1) lookup)
	getTrack(id: string): Song | undefined {
		return this.songsById[id];
	}

	// Get indexes (for fast lookups)
	getIndexes() {
		return {
			songsById: this.songsById,
		};
	}

	// Set tracks - builds songsById index only
	setTracks(songs: Song[]): void {
		if (songs.length === 0) {
			this.tracks = [];
			this.songsById = {};
			this.notify();
			return;
		}

		this.tracks = [];
		this.songsById = {};

		for (const song of songs) {
			if (!song || !song.id) continue;
			this.tracks.push(song);
			this.songsById[song.id] = song;
		}

		this.notify();
	}

	// Get count (for UI)
	getTrackCount(): number {
		return this.tracks.length;
	}

	// Search tracks (can search all 42k without React overhead)
	searchTracks(query: string, limit = 50): Song[] {
		if (!query.trim()) return [];

		const normalizedQuery = query.toLowerCase().trim();
		const results: Song[] = [];

		for (const song of this.tracks) {
			if (results.length >= limit) break;

			const title = (song.title || '').toLowerCase();
			const artist = (song.artist || '').toLowerCase();
			const album = (song.album || '').toLowerCase();

			if (title.includes(normalizedQuery) ||
			    artist.includes(normalizedQuery) ||
			    album.includes(normalizedQuery)) {
				results.push(song);
			}
		}

		return results;
	}
}

// Singleton instance - shared across entire app
export const libraryStore = new LibraryStore();
