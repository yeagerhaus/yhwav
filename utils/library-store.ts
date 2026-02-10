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

import type { Album, Artist, Song } from '@/types';
import { normalizeArtist } from './index';

class LibraryStore {
	private tracks: Song[] = [];
	private songsById: Record<string, Song> = {};
	private albumsById: Record<string, Album> = {};
	private artistsByName: Record<string, Artist> = {};
	private listeners: Set<() => void> = new Set();
	private isIndexing = false;

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

	// Get all albums
	getAlbums(): Album[] {
		return Object.values(this.albumsById);
	}

	// Get album by ID
	getAlbum(id: string): Album | undefined {
		return this.albumsById[id];
	}

	// Get all artists
	getArtists(): Artist[] {
		return Object.values(this.artistsByName);
	}

	// Get artist by name
	getArtist(name: string): Artist | undefined {
		return this.artistsByName[name];
	}

	// Get indexes (for fast lookups)
	getIndexes() {
		return {
			songsById: this.songsById,
			albumsById: this.albumsById,
			artistsByName: this.artistsByName,
		};
	}

	// Check if currently indexing
	getIsIndexing(): boolean {
		return this.isIndexing;
	}

	// Set tracks - can load all 42k at once, processes in background
	setTracks(songs: Song[]): void {
		if (songs.length === 0) {
			this.tracks = [];
			this.songsById = {};
			this.albumsById = {};
			this.artistsByName = {};
			this.isIndexing = false;
			this.notify();
			return;
		}

		// Set indexing flag
		this.isIndexing = true;
		this.notify(); // Notify that indexing started

		// Clear existing
		this.tracks = [];
		this.songsById = {};
		this.albumsById = {};
		this.artistsByName = {};

		// Process in background chunks - doesn't block UI
		const BATCH_SIZE = 1000;
		let currentIndex = 0;

		const processBatch = () => {
			const endIndex = Math.min(currentIndex + BATCH_SIZE, songs.length);

			// Process this batch
			for (let i = currentIndex; i < endIndex; i++) {
				const song = songs[i];
				if (!song || !song.id) continue;

				// Add to tracks (direct reference, no copy)
				this.tracks.push(song);
				this.songsById[song.id] = song;

				// Process album/artist
				const artistKey = normalizeArtist(song.artist || '');
				const albumName = (song.album || '').trim();
				const albumId = albumName ? `${artistKey}-${albumName.toLowerCase()}` : `${artistKey}-unknown`;

				// Album
				if (albumName && !this.albumsById[albumId]) {
					this.albumsById[albumId] = {
						id: albumId,
						title: albumName,
						artist: song.artist || '',
						artistKey,
						artwork: song.artworkUrl || song.artwork || '',
						songIds: [],
					};
				}
				if (this.albumsById[albumId]) {
					this.albumsById[albumId].songIds.push(song.id);
				}

				// Artist
				if (!this.artistsByName[artistKey]) {
					this.artistsByName[artistKey] = {
						key: artistKey,
						name: song.artist || 'Unknown Artist',
						albumIds: [],
					};
				}
				if (albumId && !this.artistsByName[artistKey].albumIds.includes(albumId)) {
					this.artistsByName[artistKey].albumIds.push(albumId);
				}
			}

			currentIndex = endIndex;

			if (currentIndex < songs.length) {
				// Process next batch asynchronously (yields to UI)
				setTimeout(processBatch, 0);
			} else {
				// Done - notify listeners
				this.isIndexing = false;
				this.notify();
			}
		};

		// Start processing (non-blocking)
		setTimeout(processBatch, 0);
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

