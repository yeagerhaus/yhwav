import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import ImageColors from 'react-native-image-colors';
import TrackPlayer, { Capability, Event, RepeatMode, State, usePlaybackState, useTrackPlayerEvents } from 'react-native-track-player';
import { usePlayback } from './PlaybackContext';
import { useSong } from './SongContext';

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
	const { currentSong, setCurrentSong } = useSong();
	const { position, duration, setPosition, setDuration, isPlaying, setIsPlaying } = usePlayback();
	const [queue, setQueue] = useState<Song[]>([]);
	const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.Queue);
	const playbackState = usePlaybackState();
	const [artworkBgColor, setArtworkBgColor] = useState<string | null>(null);

	// Sync isPlaying state with TrackPlayer state
	useEffect(() => {
		const trackPlayerIsPlaying = playbackState?.state === State.Playing;
		if (trackPlayerIsPlaying !== isPlaying) {
			setIsPlaying(trackPlayerIsPlaying);
		}
	}, [playbackState?.state, isPlaying, setIsPlaying]);

	useEffect(() => {
		const init = async () => {
			await TrackPlayer.setupPlayer();
			await TrackPlayer.updateOptions({
				alwaysPauseOnInterruption: false,
				capabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious, Capability.SeekTo],
				compactCapabilities: [Capability.Play, Capability.Pause],
				notificationCapabilities: [
					Capability.Play,
					Capability.Pause,
					Capability.SkipToNext,
					Capability.SkipToPrevious,
					Capability.SeekTo,
				],
				// Enable gapless playback
				progressUpdateEventInterval: 1,
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
						})),
					);

					// Find the index of the current song in the restored queue
					const restoredTrackIndex = queueData.findIndex((s) => s.id === currentSongData.id);
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
			Event.PlaybackState,
			Event.PlaybackTrackChanged,
			Event.PlaybackError,
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

			if (event.type === Event.PlaybackState) {
				// Playback state changed
			}

			if (event.type === Event.PlaybackTrackChanged) {
				// Update current song when TrackPlayer automatically advances
				if (event.track !== null && queue.length > 0) {
					const newCurrentSong = queue[event.track];
					if (newCurrentSong && newCurrentSong.id !== currentSong?.id) {
						setCurrentSong(newCurrentSong);
						await AsyncStorage.setItem(STORAGE_SONG_KEY, JSON.stringify(newCurrentSong));
					}
				}
			}

			if (event.type === Event.PlaybackError) {
				console.error('🎵 Playback error:', event);
			}

			if (event.type === Event.RemotePlay) TrackPlayer.play();
			if (event.type === Event.RemotePause) TrackPlayer.pause();
			if (event.type === Event.RemoteNext) skipToNext();
			if (event.type === Event.RemotePrevious) skipToPrevious();
		},
	);

	const playSound = async (song: Song, list?: Song[]) => {
		try {
			// Only reset if we're changing to a completely different queue
			const currentQueue = await TrackPlayer.getQueue();
			const isNewQueue =
				!list ||
				currentQueue.length === 0 ||
				list.length !== currentQueue.length ||
				(list.length > 0 && currentQueue.length > 0 && list[0].id !== currentQueue[0].id);

			if (isNewQueue) {
				await TrackPlayer.reset();
			}

			if (list?.length) {
				if (isNewQueue) {
					const tracks = list.map((s) => ({
						id: s.id.toString(),
						url: s.uri,
						title: s.title,
						artist: s.artist,
						artwork: s.artwork,
					}));

					await TrackPlayer.add(tracks);

					// Find the index of the current song in the queue
					const trackIndex = tracks.findIndex((t) => t.id === song.id.toString());

					if (trackIndex !== -1) {
						await TrackPlayer.skip(trackIndex);
					} else {
						await TrackPlayer.skip(0);
					}
				} else {
					// Find the index of the current song in the existing queue
					const currentQueue = await TrackPlayer.getQueue();
					const trackIndex = currentQueue.findIndex((t) => t.id === song.id.toString());

					if (trackIndex !== -1) {
						await TrackPlayer.skip(trackIndex);
					}
				}

				setQueue(list);
				await AsyncStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(list));
			} else {
				const trackData = {
					id: song.id.toString(),
					url: song.uri,
					title: song.title,
					artist: song.artist,
					artwork: song.artwork,
				};
				await TrackPlayer.add(trackData);
			}

			// Only update currentSong if it's actually different
			if (!currentSong || currentSong.id !== song.id) {
				setCurrentSong(song);
			}
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
					// Check TrackPlayer state before playing
					const _state = await TrackPlayer.getState();

					// Get current track info
					const _currentTrack = await TrackPlayer.getCurrentTrack();

					// Get queue info
					const _queue = await TrackPlayer.getQueue();

					// Test if the audio URL is accessible
					if (song.uri) {
						try {
							const response = await fetch(song.uri, { method: 'HEAD' });
							if (!response.ok) {
								console.warn('⚠️ Audio URL may not be accessible:', response.status);
							}
						} catch (urlError) {
							console.warn('⚠️ Could not test audio URL:', urlError);
						}
					}

					await TrackPlayer.play();

					// Check state after playing
					setTimeout(async () => {
						const newState = await TrackPlayer.getState();

						// If not playing, try alternative approaches
						if (newState !== State.Playing) {
							const _currentTrackInfo = await TrackPlayer.getCurrentTrack();

							// Try to pause and play again
							try {
								await TrackPlayer.pause();
								await new Promise((resolve) => setTimeout(resolve, 100));
								await TrackPlayer.play();

								setTimeout(async () => {
									const _retryState = await TrackPlayer.getState();
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
		const currentIndex = queue.findIndex((s) => String(s.id) === String(currentSong.id));

		if (currentIndex === -1) {
			console.warn('🎵 Current song not found in queue');
			return;
		}

		const nextSong = queue[(currentIndex + 1) % queue.length];
		await playSound(nextSong, queue);
	}, [currentSong, queue]);

	const playPreviousSong = useCallback(async () => {
		if (!currentSong || queue.length === 0) return;

		// restart song if position >= 3s
		try {
			const currentPosition = await TrackPlayer.getPosition();
			if (currentPosition >= 3) {
				await playSound(currentSong, queue);
				return;
			}
		} catch (err) {
			console.warn('🎵 Failed to get position:', err);
		}
		const currentIndex = queue.findIndex((s) => String(s.id) === String(currentSong.id));

		if (currentIndex === -1) {
			console.warn('🎵 Current song not found in queue');
			return;
		}

		const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
		const prevSong = queue[prevIndex];
		await playSound(prevSong, queue);
	}, [currentSong, queue]);

	const seekTo = async (pos: number) => {
		await TrackPlayer.seekTo(pos);
		setPosition(pos);
		await AsyncStorage.setItem(STORAGE_POSITION_KEY, String(pos));
	};

	const skipToNext = async () => {
		try {
			await TrackPlayer.skipToNext();
		} catch (error) {
			console.warn('TrackPlayer.skipToNext failed, using fallback:', error);
			await playNextSong();
		}
	};

	const skipToPrevious = async () => {
		try {
			await TrackPlayer.skipToPrevious();
		} catch (error) {
			console.warn('TrackPlayer.skipToPrevious failed, using fallback:', error);
			await playPreviousSong();
		}
	};

	const toggleRepeat = async () => {
		const nextMode =
			repeatMode === RepeatMode.Off ? RepeatMode.Track : repeatMode === RepeatMode.Track ? RepeatMode.Queue : RepeatMode.Off;

		await TrackPlayer.setRepeatMode(nextMode);
		setRepeatMode(nextMode);
	};

	return (
		<AudioContext.Provider
			value={{
				isPlaying,
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
