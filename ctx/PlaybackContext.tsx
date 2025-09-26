import { createContext, useContext, useState } from 'react';

interface PlaybackContextType {
	isPlaying: boolean;
	position: number;
	duration: number;
	setPosition: (position: number) => void;
	setDuration: (duration: number) => void;
	setIsPlaying: (isPlaying: boolean) => void;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
	const [isPlaying, setIsPlaying] = useState(false);
	const [position, setPosition] = useState(0);
	const [duration, setDuration] = useState(0);

	return (
		<PlaybackContext.Provider
			value={{
				isPlaying,
				position,
				duration,
				setPosition,
				setDuration,
				setIsPlaying,
			}}
		>
			{children}
		</PlaybackContext.Provider>
	);
}

export function usePlayback() {
	const context = useContext(PlaybackContext);
	if (context === undefined) {
		throw new Error('usePlayback must be used within a PlaybackProvider');
	}
	return context;
}
