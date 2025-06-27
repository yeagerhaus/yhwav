import TrackPlayer, {
  Event,
  RepeatMode,
  State,
  Track,
  usePlaybackState,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface Song {
  id: number;
  title: string;
  artist: string;
  artwork: string;
  uri: string;
}

interface AudioContextType {
  isPlaying: boolean;
  currentSong: Song | null;
  position: number;
  duration: number;
  setCurrentSong: (song: Song) => void;
  playSound: (song: Song) => Promise<void>;
  pauseSound: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  playNextSong: () => Promise<void>;
  playPreviousSong: () => Promise<void>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const playbackState = usePlaybackState();

  useEffect(() => {
    TrackPlayer.setupPlayer().then(() => {
      TrackPlayer.setRepeatMode(RepeatMode.Queue);
    });

    return () => {
      TrackPlayer.reset();
    };
  }, []);

  useTrackPlayerEvents([Event.PlaybackProgressUpdated, Event.PlaybackQueueEnded], async (event) => {
    if (event.type === Event.PlaybackProgressUpdated) {
      setPosition(event.position);
      setDuration(event.duration);
    }

    if (event.type === Event.PlaybackQueueEnded && event.position > 0) {
      await playNextSong();
    }
  });

  const playSound = async (song: Song) => {
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: song.id.toString(),
      url: song.uri,
      title: song.title,
      artist: song.artist,
      artwork: song.artwork,
    } as Track);
    await TrackPlayer.play();
    setCurrentSong(song);
  };

  const pauseSound = async () => {
    await TrackPlayer.pause();
  };

  const togglePlayPause = async () => {
    const state = await TrackPlayer.getState();
    if (state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const playNextSong = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
    const nextSong = queue[(currentIndex + 1) % queue.length];
    await playSound(nextSong);
  }, [currentSong, queue]);

  const playPreviousSong = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    await playSound(queue[prevIndex]);
  }, [currentSong, queue]);

  return (
    <AudioContext.Provider
      value={{
        isPlaying: playbackState?.state === State.Playing,
        currentSong,
        position,
        duration,
        setCurrentSong: (s) => {
          setCurrentSong(s);
          setQueue((q) => (q.find((i) => i.id === s.id) ? q : [...q, s]));
        },
        playSound,
        pauseSound,
        togglePlayPause,
        playNextSong,
        playPreviousSong,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
