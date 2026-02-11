import { InteractionManager } from 'react-native';
import { create } from 'zustand';
import type { Album, Artist, Playlist, Song } from '@/types';
import { normalizeArtist } from '@/utils';
import { performanceMonitor } from '@/utils/performance';

interface LibraryState {
	isLibraryIndexing: boolean;
	tracks: Song[];
	songsById: Record<string, Song>;
	albumsById: Record<string, Album>;
	artistsByName: Record<string, Artist>;
	playlists: Playlist[];
	playlistsById: Record<string, Playlist>;
	setTracks: (songs: Song[]) => void;
	setPlaylists: (playlists: Playlist[]) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
	isLibraryIndexing: false,
	tracks: [],
	songsById: {},
	albumsById: {},
	artistsByName: {},
	playlists: [],
	playlistsById: {},

	setPlaylists: (playlists: Playlist[]) => {
		const playlistsById: Record<string, Playlist> = {};

		playlists.forEach((playlist) => {
			playlistsById[playlist.id] = playlist;
		});

		set({
			playlists,
			playlistsById,
		});
	},

	setTracks: (songs: Song[]) => {
		// CRITICAL FIX: For very large libraries, we need a completely different approach
		// Setting 42k items in state will always freeze - we need incremental updates
		
		if (songs.length === 0) {
			set({ tracks: [], songsById: {}, albumsById: {}, artistsByName: {}, isLibraryIndexing: false });
			return;
		}

		// Set indexing flag immediately
		set({ isLibraryIndexing: true, tracks: [], songsById: {}, albumsById: {}, artistsByName: {} });

		// For very large libraries, process in much smaller chunks and update incrementally
		const isLargeLibrary = songs.length > 10000;
		const BATCH_SIZE = isLargeLibrary ? 100 : 500; // Much smaller batches for huge libraries
		
		// Accumulate results
		const songsById: Record<string, Song> = {};
		const albumsById: Record<string, Album> = {};
		const artistsByName: Record<string, Artist> = {};
		const processedTracks: Song[] = [];
		
		let currentIndex = 0;
		let updateCount = 0;
		let lastUpdateIndex = 0;
		const UPDATE_INTERVAL = isLargeLibrary ? 1000 : 2000; // Update state every N tracks

		const endTimer = performanceMonitor.startTimer('library-indexing');
		console.log(`🔄 Starting library indexing for ${songs.length} tracks (batch size: ${BATCH_SIZE})...`);

		const processBatch = () => {
			const startTime = performance.now();
			const endIndex = Math.min(currentIndex + BATCH_SIZE, songs.length);

			// Process this batch
			for (let i = currentIndex; i < endIndex; i++) {
				const song = songs[i];
				if (!song || !song.id) continue;

				const artistKey = normalizeArtist(song.artist || '');
				const albumName = (song.album || '').trim();
				const albumId = albumName ? `${artistKey}-${albumName.toLowerCase()}` : `${artistKey}-unknown`;

				songsById[song.id] = song;
				processedTracks.push(song);

				// Album
				if (albumName && !albumsById[albumId]) {
					albumsById[albumId] = {
						id: albumId,
						title: albumName,
						artist: song.artist || '',
						artistKey,
						artwork: song.artworkUrl || song.artwork || '',
						songIds: [],
					};
				}
				if (albumsById[albumId]) {
					albumsById[albumId].songIds.push(song.id);
				}

				// Artist
				if (!artistsByName[artistKey]) {
					artistsByName[artistKey] = {
						key: artistKey,
						name: song.artist || 'Unknown Artist',
						albumIds: [],
					};
				}
				if (albumId && !artistsByName[artistKey].albumIds.includes(albumId)) {
					artistsByName[artistKey].albumIds.push(albumId);
				}
			}

			currentIndex = endIndex;
			const batchTime = performance.now() - startTime;

			// CRITICAL: Don't update tracks array during indexing - it causes re-renders!
			// Only update indexes during processing, tracks array only at the end
			if (isLargeLibrary && currentIndex - lastUpdateIndex >= UPDATE_INTERVAL) {
				// Only update indexes, NOT tracks array - prevents component re-renders
				set({
					// tracks: NOT updated - keep empty until done
					songsById: { ...songsById },
					albumsById: { ...albumsById },
					artistsByName: { ...artistsByName },
					isLibraryIndexing: true,
				});
				lastUpdateIndex = currentIndex;
				updateCount++;
				console.log(`📊 Indexed ${currentIndex}/${songs.length} tracks (${updateCount} updates)`);
			}

			if (currentIndex < songs.length) {
				// Calculate delay based on batch processing time to keep UI responsive
				// If batch took >16ms, we need longer delay to maintain 60fps
				const delay = batchTime > 16 ? 20 : (isLargeLibrary ? 5 : 0);
				
				// Use requestAnimationFrame for better scheduling when possible
				if (typeof requestAnimationFrame !== 'undefined' && delay === 0) {
					requestAnimationFrame(processBatch);
				} else {
					setTimeout(processBatch, delay);
				}
			} else {
				// All processing complete - final update
				// Use the same reference, no expensive array copy
				set({
					tracks: processedTracks, // Direct reference, no spread
					songsById,
					albumsById,
					artistsByName,
					isLibraryIndexing: false,
				});
				endTimer({ trackCount: songs.length, incrementalUpdates: updateCount });
				console.log(`✅ Library indexing complete: ${songs.length} tracks processed (${updateCount} incremental updates)`);
			}
		};

		// Start processing after a delay to let UI render first
		InteractionManager.runAfterInteractions(() => {
			// Additional delay for very large libraries
			setTimeout(processBatch, isLargeLibrary ? 300 : 100);
		});
	},
}));
