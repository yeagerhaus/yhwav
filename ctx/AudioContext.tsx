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
  id: string;
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

		// Find the index of the current song in the restored queue
		const restoredTrackIndex = queueData.findIndex(s => s.id === currentSongData.id);
		console.log('🎵 Found restored track index:', restoredTrackIndex, 'for song ID:', currentSongData.id);
		
		if (restoredTrackIndex !== -1) {
			await TrackPlayer.skip(restoredTrackIndex);
			console.log('🎵 Skipped to restored track index:', restoredTrackIndex);
		} else {
			console.warn('🎵 Restored song not found in queue, skipping to first track');
			await TrackPlayer.skip(0);
		}
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
    try {
      console.log('🎵 ===== STARTING PLAYBACK =====');
      console.log('🎵 Song data:', {
        id: song.id,
        title: song.title,
        artist: song.artist,
        uri: song.uri,
        artwork: song.artwork
      });
      console.log('🎵 Queue length:', list?.length || 0);
      console.log('🎵 Song URI check:', song.uri ? 'URI present' : 'URI missing!');
      
      await TrackPlayer.reset();
      console.log('🎵 TrackPlayer reset complete');

      if (list?.length) {
        console.log('🎵 Adding queue with', list.length, 'tracks');
        const tracks = list.map((s) => ({
          id: s.id.toString(),
          url: s.uri,
          title: s.title,
          artist: s.artist,
          artwork: s.artwork,
        }));
        
        console.log('🎵 Track data being added:', tracks.map(t => ({ id: t.id, url: t.url, title: t.title })));
        await TrackPlayer.add(tracks);
        console.log('🎵 Tracks added to queue');
        
        // Verify tracks were added
        const queueAfterAdd = await TrackPlayer.getQueue();
        console.log('🎵 Queue after adding tracks:', queueAfterAdd.length);
        
        // Find the index of the current song in the queue
        const trackIndex = tracks.findIndex(t => t.id === song.id.toString());
        console.log('🎵 Found track index:', trackIndex, 'for song ID:', song.id);
        
        if (trackIndex !== -1) {
          await TrackPlayer.skip(trackIndex);
          console.log('🎵 Skipped to track index:', trackIndex);
        } else {
          console.warn('🎵 Song not found in queue, skipping to first track');
          await TrackPlayer.skip(0);
        }
        
        // Verify we're on the right track
        const currentTrackAfterSkip = await TrackPlayer.getCurrentTrack();
        console.log('🎵 Current track after skip:', currentTrackAfterSkip);
        
        setQueue(list);
        await AsyncStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(list));
      } else {
        console.log('🎵 Adding single track');
        const trackData = {
          id: song.id.toString(),
          url: song.uri,
          title: song.title,
          artist: song.artist,
          artwork: song.artwork,
        };
        console.log('🎵 Single track data:', trackData);
        await TrackPlayer.add(trackData);
        console.log('🎵 Single track added');
        
        // Verify single track was added
        const queueAfterSingleAdd = await TrackPlayer.getQueue();
        console.log('🎵 Queue after adding single track:', queueAfterSingleAdd.length);
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
      
      // Add a small delay to ensure track is properly loaded before playing
      setTimeout(async () => {
        try {
          console.log('🎵 Attempting to start playback...');
          
          // Check TrackPlayer state before playing
          const state = await TrackPlayer.getState();
          console.log('🎵 TrackPlayer state before play:', state);
          
          // Get current track info
          const currentTrack = await TrackPlayer.getCurrentTrack();
          console.log('🎵 Current track ID:', currentTrack);
          
          // Get queue info
          const queue = await TrackPlayer.getQueue();
          console.log('🎵 Queue length:', queue.length);
          
          // Test if the audio URL is accessible
          if (song.uri) {
            console.log('🎵 Testing audio URL accessibility...');
            try {
              const response = await fetch(song.uri, { method: 'HEAD' });
              console.log('🎵 Audio URL response status:', response.status);
              if (!response.ok) {
                console.warn('⚠️ Audio URL may not be accessible:', response.status);
              }
            } catch (urlError) {
              console.warn('⚠️ Could not test audio URL:', urlError);
            }
          }
          
          await TrackPlayer.play();
          console.log('✅ TrackPlayer.play() called successfully');
          
          // Check state after playing
          setTimeout(async () => {
            const newState = await TrackPlayer.getState();
            console.log('🎵 TrackPlayer state after play:', newState);
            console.log('🎵 Is actually playing?', newState === State.Playing);
            
            // If not playing, try alternative approaches
            if (newState !== State.Playing) {
              console.log('🎵 Playback failed - trying alternative approaches...');
              const currentTrackInfo = await TrackPlayer.getCurrentTrack();
              console.log('🎵 Current track info:', currentTrackInfo);
              
              // Try to pause and play again
              try {
                console.log('🎵 Trying pause/play cycle...');
                await TrackPlayer.pause();
                await new Promise(resolve => setTimeout(resolve, 100));
                await TrackPlayer.play();
                
                setTimeout(async () => {
                  const retryState = await TrackPlayer.getState();
                  console.log('🎵 State after retry:', retryState);
                }, 500);
              } catch (retryError) {
                console.error('🎵 Retry failed:', retryError);
              }
            }
          }, 500);
          
        } catch (playError) {
          console.error('❌ Failed to start playback:', playError);
        }
      }, 100);
    } catch (error) {
      console.error('Error in playSound:', error);
    }
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
    console.log('🎵 playNextSong - currentSong:', currentSong.id, 'queue length:', queue.length);
    const currentIndex = queue.findIndex((s) => String(s.id) === String(currentSong.id));
    console.log('🎵 playNextSong - currentIndex:', currentIndex);
    
    if (currentIndex === -1) {
      console.warn('🎵 Current song not found in queue');
      return;
    }
    
    const nextSong = queue[(currentIndex + 1) % queue.length];
    console.log('🎵 playNextSong - nextSong:', nextSong.title);
    await playSound(nextSong, queue);
  }, [currentSong, queue]);

  const playPreviousSong = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;
    console.log('🎵 playPreviousSong - currentSong:', currentSong.id, 'queue length:', queue.length);
    const currentIndex = queue.findIndex((s) => String(s.id) === String(currentSong.id));
    console.log('🎵 playPreviousSong - currentIndex:', currentIndex);
    
    if (currentIndex === -1) {
      console.warn('🎵 Current song not found in queue');
      return;
    }
    
    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    const prevSong = queue[prevIndex];
    console.log('🎵 playPreviousSong - prevSong:', prevSong.title);
    await playSound(prevSong, queue);
  }, [currentSong, queue]);

  const seekTo = async (pos: number) => {
    await TrackPlayer.seekTo(pos);
    setPosition(pos);
    await AsyncStorage.setItem(STORAGE_POSITION_KEY, String(pos));
  };

  const skipToNext = async () => {
    try {
      console.log('🎵 skipToNext - attempting TrackPlayer.skipToNext()');
      await TrackPlayer.skipToNext();
      console.log('✅ TrackPlayer.skipToNext() succeeded');
    } catch (error) {
      console.warn('TrackPlayer.skipToNext failed, using fallback:', error);
      await playNextSong();
    }
  };

  const skipToPrevious = async () => {
    try {
      console.log('🎵 skipToPrevious - attempting TrackPlayer.skipToPrevious()');
      await TrackPlayer.skipToPrevious();
      console.log('✅ TrackPlayer.skipToPrevious() succeeded');
    } catch (error) {
      console.warn('TrackPlayer.skipToPrevious failed, using fallback:', error);
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
