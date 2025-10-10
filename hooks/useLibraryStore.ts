import { create } from 'zustand';
import type { Album, Artist, Playlist, Song } from '@/types';
import { normalizeArtist } from '@/utils/song';

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
		const BATCH_SIZE = 500;
		const processBatch = (startIndex: number) => {
			const endIndex = Math.min(startIndex + BATCH_SIZE, songs.length);

			for (let i = startIndex; i < endIndex; i++) {
				const song = songs[i];
				const artistKey = normalizeArtist(song.artist);
				const albumId = `${artistKey}-${song.album.trim().toLowerCase()}`;

				songsById[song.id] = song;

				// Album
				if (!albumsById[albumId]) {
					albumsById[albumId] = {
						id: albumId,
						title: song.album,
						artist: song.artist,
						artistKey,
						artwork: song.artworkUrl || song.artwork || '',
						songIds: [],
					};
				}
				albumsById[albumId].songIds.push(song.id);

				// Artist
				if (!artistsByName[artistKey]) {
					artistsByName[artistKey] = {
						key: artistKey,
						name: song.artist,
						albumIds: [],
					};
				}
				if (!artistsByName[artistKey].albumIds.includes(albumId)) {
					artistsByName[artistKey].albumIds.push(albumId);
				}
			}
		};

		// Process all batches
		for (let startIndex = 0; startIndex < songs.length; startIndex += BATCH_SIZE) {
			processBatch(startIndex);
		}

		set({
			tracks: songs,
			songsById,
			albumsById,
			artistsByName,
		});
	},
}));
