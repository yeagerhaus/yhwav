import TrackPlayer, {
  Capability,
  Event,
  RepeatMode,
  State,
  Track,
  usePlaybackState,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageColors from 'react-native-image-colors';

export const STORAGE_QUEUE_KEY = 'SONG_QUEUE';
export const STORAGE_SONG_KEY = 'CURRENT_SONG';
export const STORAGE_POSITION_KEY = 'CURRENT_POSITION';

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
	repeatMode: RepeatMode;
	playSound: (song: Song, queue?: Song[]) => Promise<void>;
	pauseSound: () => Promise<void>;
	togglePlayPause: () => Promise<void>;
	playNextSong: () => Promise<void>;
	playPreviousSong: () => Promise<void>;
	seekTo: (pos: number) => Promise<void>;
	skipToNext: () => Promise<void>;
	skipToPrevious: () => Promise<void>;
	toggleRepeat: () => Promise<void>;
    artworkBgColor: string | null;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
	const [currentSong, setCurrentSong] = useState<Song | null>(null);
	const [queue, setQueue] = useState<Song[]>([]);
	const [position, setPosition] = useState(0);
	const [duration, setDuration] = useState(0);
	const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.Queue);
	const playbackState = usePlaybackState();
	const [artworkBgColor, setArtworkBgColor] = useState<string | null>(null);


  useEffect(() => {
    const init = async () => {
		await TrackPlayer.setupPlayer();
		await TrackPlayer.updateOptions({
			alwaysPauseOnInterruption: false,
			capabilities: [
				Capability.Play,
				Capability.Pause,
				Capability.SkipToNext,
				Capability.SkipToPrevious,
				Capability.SeekTo,
			],
			compactCapabilities: [Capability.Play, Capability.Pause],
			notificationCapabilities: [
				Capability.Play,
				Capability.Pause,
				Capability.SkipToNext,
				Capability.SkipToPrevious,
				Capability.SeekTo,
		],
		});


		try {
		const savedSongStr = await AsyncStorage.getItem(STORAGE_SONG_KEY);
		const savedQueueStr = await AsyncStorage.getItem(STORAGE_QUEUE_KEY);
		const savedPosStr = await AsyncStorage.getItem(STORAGE_POSITION_KEY);

		if (savedQueueStr && savedSongStr) {
		const queueData: Song[] = JSON.parse(savedQueueStr);
		const currentSongData: Song = JSON.parse(savedSongStr);
		const position = savedPosStr ? Number(savedPosStr) : 0;

		await TrackPlayer.add(
			queueData.map((s) => ({
			id: s.id.toString(),
			url: s.uri,
			title: s.title,
			artist: s.artist,
			artwork: s.artwork,
			}))
		);

		await TrackPlayer.skip(currentSongData.id);
		if (position > 0) await TrackPlayer.seekTo(position);

		setCurrentSong(currentSongData);
		setQueue(queueData);
		}
	} catch (err) {
		console.warn('Failed to restore playback state:', err);
	}

	await TrackPlayer.setRepeatMode(RepeatMode.Queue);
	};

    init();

    return () => {
      TrackPlayer.reset();
    };
  }, []);

  useTrackPlayerEvents(
    [
      Event.PlaybackProgressUpdated,
      Event.PlaybackQueueEnded,
      Event.RemotePlay,
      Event.RemotePause,
      Event.RemoteNext,
      Event.RemotePrevious,
      Event.RemoteSeek,
    ],
    async (event) => {
      if (event.type === Event.PlaybackProgressUpdated) {
        setPosition(event.position);
        setDuration(event.duration);
        await AsyncStorage.setItem(STORAGE_POSITION_KEY, String(event.position));
      }

      if (event.type === Event.PlaybackQueueEnded && event.position > 0) {
        await playNextSong();
      }

      if (event.type === Event.RemotePlay) TrackPlayer.play();
      if (event.type === Event.RemotePause) TrackPlayer.pause();
      if (event.type === Event.RemoteNext) skipToNext();
      if (event.type === Event.RemotePrevious) skipToPrevious();
    },
  );

  const playSound = async (song: Song, list?: Song[]) => {
    await TrackPlayer.reset();

    if (list?.length) {
		await TrackPlayer.add(
			list.map((s) => ({
			id: s.id.toString(),
			url: s.uri,
			title: s.title,
			artist: s.artist,
			artwork: s.artwork,
			})),
		);
		await TrackPlayer.skip(song.id);
		setQueue(list);
		await AsyncStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(list));
	} else {
      await TrackPlayer.add({
        id: song.id.toString(),
        url: song.uri,
        title: song.title,
        artist: song.artist,
        artwork: song.artwork,
      });
    }

    setCurrentSong(song);
	try {
		const result = await ImageColors.getColors(song.artwork, {
			fallback: '#000',
			cache: true,
			key: song.id.toString(),
		});
		let color = '#000';
		if (result.platform === 'android' || result.platform === 'web') {
			color = result.dominant || '#000';
		} else if (result.platform === 'ios') {
			color = result.background || '#000';
		}
		setArtworkBgColor(color);
	} catch (err) {
		console.warn('Failed to extract artwork color:', err);
		setArtworkBgColor('#000');
	}

    await AsyncStorage.setItem(STORAGE_SONG_KEY, JSON.stringify(song));
    await AsyncStorage.removeItem(STORAGE_POSITION_KEY);
    await TrackPlayer.play();
  };

  const pauseSound = async () => TrackPlayer.pause();

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
    await playSound(nextSong, queue);
  }, [currentSong, queue]);

  const playPreviousSong = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    await playSound(queue[prevIndex], queue);
  }, [currentSong, queue]);

  const seekTo = async (pos: number) => {
    await TrackPlayer.seekTo(pos);
    setPosition(pos);
    await AsyncStorage.setItem(STORAGE_POSITION_KEY, String(pos));
  };

  const skipToNext = async () => {
    try {
      await TrackPlayer.skipToNext();
    } catch {
      await playNextSong();
    }
  };

  const skipToPrevious = async () => {
    try {
      await TrackPlayer.skipToPrevious();
    } catch {
      await playPreviousSong();
    }
  };

  const toggleRepeat = async () => {
    const nextMode =
      repeatMode === RepeatMode.Off
        ? RepeatMode.Track
        : repeatMode === RepeatMode.Track
        ? RepeatMode.Queue
        : RepeatMode.Off;

    await TrackPlayer.setRepeatMode(nextMode);
    setRepeatMode(nextMode);
  };

  return (
    <AudioContext.Provider
      value={{
        isPlaying: playbackState?.state === State.Playing,
        currentSong,
        position,
        duration,
        repeatMode,
        playSound,
        pauseSound,
        togglePlayPause,
        playNextSong,
        playPreviousSong,
        seekTo,
        skipToNext,
        skipToPrevious,
        toggleRepeat,
        artworkBgColor,
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
