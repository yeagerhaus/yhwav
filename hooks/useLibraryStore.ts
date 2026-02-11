import { create } from 'zustand';
import type { Playlist, Song } from '@/types';
import { performanceMonitor } from '@/utils/performance';

interface LibraryState {
	tracks: Song[];
	songsById: Record<string, Song>;
	playlists: Playlist[];
	playlistsById: Record<string, Playlist>;
	setTracks: (songs: Song[]) => void;
	setPlaylists: (playlists: Playlist[]) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
	tracks: [],
	songsById: {},
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
		if (songs.length === 0) {
			set({ tracks: [], songsById: {} });
			return;
		}

		const endTimer = performanceMonitor.startTimer('library-indexing');

		const songsById: Record<string, Song> = {};
		for (const song of songs) {
			if (song?.id) {
				songsById[song.id] = song;
			}
		}

		set({ tracks: songs, songsById });
		endTimer({ trackCount: songs.length });
		console.log(`✅ Library indexed: ${songs.length} tracks`);
	},
}));
