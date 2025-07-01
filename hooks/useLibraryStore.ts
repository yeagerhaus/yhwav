import { create } from 'zustand';
import { Song } from '@/types/song';

interface LibraryState {
  tracks: Song[];
  setTracks: (songs: Song[]) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  tracks: [],
  setTracks: (songs) => set({ tracks: songs }),
}));
