import { InteractionManager } from 'react-native';
import { create } from 'zustand';
import type { Album, Artist, Playlist, Song } from '@/types';
import { normalizeArtist } from '@/utils';

interface LibraryState {
	isLibraryLoading: boolean;
	tracks: Song[];
	songsById: Record<string, Song>;
	albumsById: Record<string, Album>;
	artistsByName: Record<string, Artist>;
	playlists: Playlist[];
	playlistsById: Record<string, Playlist>;
	setTracks: (songs: Song[]) => void;
	setPlaylists: (playlists: Playlist[]) => void;
	setLibraryLoading: (loading: boolean) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
	isLibraryLoading: false,
	tracks: [],
	songsById: {},
	albumsById: {},
	artistsByName: {},
	playlists: [],
	playlistsById: {},

	setLibraryLoading: (loading: boolean) => set({ isLibraryLoading: loading }),

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
		// For immediate UI update, set tracks first
		set({ tracks: songs });

		// Process indexing asynchronously to avoid blocking UI
		InteractionManager.runAfterInteractions(() => {
			// Accumulate results across batches
			const songsById: Record<string, Song> = {};
			const albumsById: Record<string, Album> = {};
			const artistsByName: Record<string, Artist> = {};

			// Process songs in smaller batches with yields to keep UI responsive
			const BATCH_SIZE = 500; // Smaller batches for better responsiveness
			let currentIndex = 0;

			const processBatch = () => {
				const endIndex = Math.min(currentIndex + BATCH_SIZE, songs.length);

				for (let i = currentIndex; i < endIndex; i++) {
					const song = songs[i];
					if (!song || !song.id) continue; // Skip invalid songs

					const artistKey = normalizeArtist(song.artist || '');
					const albumName = (song.album || '').trim();
					const albumId = albumName ? `${artistKey}-${albumName.toLowerCase()}` : `${artistKey}-unknown`;

					songsById[song.id] = song;

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

				if (currentIndex < songs.length) {
					// Process next batch after a short delay to allow UI updates
					setTimeout(processBatch, 0);
				} else {
					// All processing complete, update state
					set({
						songsById,
						albumsById,
						artistsByName,
					});
				}
			};

			processBatch();
		});
	},
}));
