import { create } from 'zustand';
import { Album, Artist, Song } from '@/types';
import { normalizeArtist } from '@/utils/song';

interface LibraryState {
  isLibraryLoading: boolean;
  tracks: Song[];
  songsById: Record<string, Song>;
  albumsById: Record<string, Album>;
  artistsByName: Record<string, Artist>;
  setTracks: (songs: Song[]) => void;
  setLibraryLoading: (loading: boolean) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
	isLibraryLoading: false,
	tracks: [],
	songsById: {},
	albumsById: {},
	artistsByName: {},

	setLibraryLoading: (loading: boolean) => set({ isLibraryLoading: loading }),

	setTracks: async (songs: Song[]) => {
		const songsById: Record<string, Song> = {};
		const albumsById: Record<string, Album> = {};
		const artistsByName: Record<string, Artist> = {};

		for (let i = 0; i < songs.length; i++) {
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

			// Yield to JS thread every 1000 iterations
			if (i % 1000 === 0) {
			await new Promise((res) => setTimeout(res, 0));
			}
		}

		console.log('🎵 setTracks got', songs.length, 'songs, ', albumsById.length, ' albums, ', artistsByName.length, ' artists');
		set({
			tracks: songs,
			songsById,
			albumsById,
			artistsByName,
		});
		},
}));
