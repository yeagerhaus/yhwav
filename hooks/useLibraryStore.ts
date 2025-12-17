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
		const songsById: Record<string, Song> = {};
		const albumsById: Record<string, Album> = {};
		const artistsByName: Record<string, Artist> = {};

		// Process songs in batches to avoid blocking the main thread
		// Optimized for large libraries - process synchronously but efficiently
		const BATCH_SIZE = 2000; // Larger batches for better performance with modern devices
		
		for (let startIndex = 0; startIndex < songs.length; startIndex += BATCH_SIZE) {
			const endIndex = Math.min(startIndex + BATCH_SIZE, songs.length);

			for (let i = startIndex; i < endIndex; i++) {
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
		}

		set({
			tracks: songs,
			songsById,
			albumsById,
			artistsByName,
		});
	},
}));
