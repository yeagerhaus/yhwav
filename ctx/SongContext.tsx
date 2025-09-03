import { createContext, useContext, useState } from 'react';

interface Song {
	id: string;
	title: string;
	artist: string;
	artwork: string;
	uri: string;
}

interface SongContextType {
	currentSong: Song | null;
	setCurrentSong: (song: Song | null) => void;
}

const SongContext = createContext<SongContextType | undefined>(undefined);

export function SongProvider({ children }: { children: React.ReactNode }) {
	const [currentSong, setCurrentSong] = useState<Song | null>(null);

	console.log('🎵 SongContext render - currentSong:', currentSong?.title, 'ID:', currentSong?.id);

	const wrappedSetCurrentSong = (song: Song | null) => {
		console.log('🎵 SongContext setCurrentSong called - new song:', song?.title, 'ID:', song?.id);
		setCurrentSong(song);
	};

	return (
		<SongContext.Provider value={{ currentSong, setCurrentSong: wrappedSetCurrentSong }}>
			{children}
		</SongContext.Provider>
	);
}

export function useSong() {
	const context = useContext(SongContext);
	if (context === undefined) {
		throw new Error('useSong must be used within a SongProvider');
	}
	return context;
}
