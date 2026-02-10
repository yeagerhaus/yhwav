import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import React from 'react';
import ImageColors from 'react-native-image-colors';
import TrackPlayer, { Capability, Event, RepeatMode, State, usePlaybackState, useTrackPlayerEvents } from 'react-native-track-player';
import { create } from 'zustand';
import type { Song } from '@/types';
import { performanceMonitor } from '@/utils/performance';

// Storage keys
export const STORAGE_QUEUE_KEY = 'SONG_QUEUE';
export const STORAGE_ORIGINAL_QUEUE_KEY = 'ORIGINAL_QUEUE';
export const STORAGE_SONG_KEY = 'CURRENT_SONG';
export const STORAGE_POSITION_KEY = 'CURRENT_POSITION';
export const STORAGE_REPEAT_MODE_KEY = 'REPEAT_MODE';
export const STORAGE_SHUFFLE_KEY = 'SHUFFLE_MODE';
export const STORAGE_VOLUME_KEY = 'VOLUME';
export const STORAGE_PLAYBACK_RATE_KEY = 'PLAYBACK_RATE';

// Lightweight queue persistence — save only IDs, resolve from library store
function saveQueueState(queue: Song[], originalQueue: Song[], currentSong: Song | null) {
	const queueIds = queue.map((s) => s.id);
	const originalIds = originalQueue.map((s) => s.id);
	const ops: Promise<void>[] = [
		AsyncStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queueIds)),
		AsyncStorage.setItem(STORAGE_ORIGINAL_QUEUE_KEY, JSON.stringify(originalIds)),
	];
	if (currentSong) {
		ops.push(AsyncStorage.setItem(STORAGE_SONG_KEY, currentSong.id));
	}
	Promise.all(ops).catch(() => {});
}

function saveCurrentSongId(song: Song) {
	AsyncStorage.setItem(STORAGE_SONG_KEY, song.id).catch(() => {});
}

function resolveIdsToSongs(ids: string[]): Song[] {
	const { useLibraryStore } = require('@/hooks/useLibraryStore');
	const songsById = useLibraryStore.getState().songsById;
	const songs: Song[] = [];
	for (const id of ids) {
		const song = songsById[id];
		if (song) songs.push(song);
	}
	return songs;
}

// Artwork color cache
const artworkColorCache = new Map<string, string>();

interface AudioState {
	// Playback state
	currentSong: Song | null;
	queue: Song[];
	originalQueue: Song[];
	isPlaying: boolean;
	position: number;
	duration: number;
	repeatMode: RepeatMode;
	isShuffled: boolean;
	volume: number;
	playbackRate: number;
	isBuffering: boolean;
	error: string | null;
	artworkBgColor: string | null;

	// Playback actions
	playSound: (song: Song, queue?: Song[]) => Promise<void>;
	togglePlayPause: () => Promise<void>;
	skipToNext: () => Promise<void>;
	skipToPrevious: () => Promise<void>;
	seekTo: (position: number) => Promise<void>;

	// Queue management
	addToQueue: (songs: Song[]) => Promise<void>;
	playNext: (song: Song) => Promise<void>;
	removeFromQueue: (index: number) => void;
	clearQueue: () => void;
	reorderQueue: (fromIndex: number, toIndex: number) => void;
	getQueue: () => Song[];

	// Settings
	toggleRepeat: () => Promise<void>;
	toggleShuffle: () => Promise<void>;
	setVolume: (volume: number) => Promise<void>;
	setPlaybackRate: (rate: number) => Promise<void>;

	// Internal state management
	_setIsPlaying: (isPlaying: boolean) => void;
	_setPosition: (position: number) => void;
	_setDuration: (duration: number) => void;
	_setCurrentSong: (song: Song | null) => void;
	_setIsBuffering: (isBuffering: boolean) => void;
	_setError: (error: string | null) => void;
	_setArtworkBgColor: (color: string | null) => void;

	// Initialization
	initializePlayer: () => Promise<void>;
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

// Shuffle queue while keeping current song at the beginning
function createShuffledQueue(queue: Song[], currentSong: Song | null): Song[] {
	if (!currentSong || queue.length <= 1) return queue;

	const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
	if (currentIndex === -1) return shuffleArray(queue);

	const withoutCurrent = queue.filter((_, i) => i !== currentIndex);
	const shuffled = shuffleArray(withoutCurrent);
	return [currentSong, ...shuffled];
}

// Debounced position save (max once per 2 seconds)
let positionSaveTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSavePosition = (position: number) => {
	if (positionSaveTimeout) {
		clearTimeout(positionSaveTimeout);
	}
	positionSaveTimeout = setTimeout(async () => {
		await AsyncStorage.setItem(STORAGE_POSITION_KEY, String(position));
		positionSaveTimeout = null;
	}, 2000);
};

// Extract artwork color with caching
async function extractArtworkColor(song: Song): Promise<string> {
	// Check cache first
	if (artworkColorCache.has(song.id)) {
		return artworkColorCache.get(song.id)!;
	}

	const artworkUrl = song.artworkUrl || song.artwork;
	if (!artworkUrl) {
		return '#000';
	}

	try {
		const result = await ImageColors.getColors(artworkUrl, {
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

		// Cache the result
		artworkColorCache.set(song.id, color);
		return color;
	} catch (err) {
		console.warn('Failed to extract artwork color:', err);
		return '#000';
	}
}

// Convert Song to TrackPlayer track
function songToTrack(song: Song) {
	return {
		id: song.id.toString(),
		url: song.uri,
		title: song.title,
		artist: song.artist,
		artwork: song.artworkUrl || song.artwork,
		duration: song.duration,
	};
}

export const useAudioStore = create<AudioState>((set, get) => ({
	// Initial state
	currentSong: null,
	queue: [],
	originalQueue: [],
	isPlaying: false,
	position: 0,
	duration: 0,
	repeatMode: RepeatMode.Queue,
	isShuffled: false,
	volume: 1.0,
	playbackRate: 1.0,
	isBuffering: false,
	error: null,
	artworkBgColor: null,

	// Internal setters
	_setIsPlaying: (isPlaying) => set({ isPlaying }),
	_setPosition: (position) => {
		set({ position });
		debouncedSavePosition(position);
	},
	_setDuration: (duration) => set({ duration }),
	_setCurrentSong: (song) => set({ currentSong: song }),
	_setIsBuffering: (isBuffering) => set({ isBuffering }),
	_setError: (error) => set({ error }),
	_setArtworkBgColor: (color) => set({ artworkBgColor: color }),

	// Initialize TrackPlayer
	initializePlayer: async () => {
		try {
			// Try to setup player, but ignore if already initialized
			try {
				await TrackPlayer.setupPlayer();
			} catch (setupError: any) {
				// If player is already initialized, that's fine - just continue
				if (setupError?.message?.includes('already been initialized')) {
					console.log('TrackPlayer already initialized, skipping setup');
				} else {
					// Re-throw other errors
					throw setupError;
				}
			}

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
				progressUpdateEventInterval: 1,
			});

			// Restore saved state
			try {
				const [
					savedSongStr,
					savedQueueStr,
					savedOriginalQueueStr,
					savedPosStr,
					savedRepeatStr,
					savedShuffleStr,
					savedVolumeStr,
					savedRateStr,
				] = await Promise.all([
					AsyncStorage.getItem(STORAGE_SONG_KEY),
					AsyncStorage.getItem(STORAGE_QUEUE_KEY),
					AsyncStorage.getItem(STORAGE_ORIGINAL_QUEUE_KEY),
					AsyncStorage.getItem(STORAGE_POSITION_KEY),
					AsyncStorage.getItem(STORAGE_REPEAT_MODE_KEY),
					AsyncStorage.getItem(STORAGE_SHUFFLE_KEY),
					AsyncStorage.getItem(STORAGE_VOLUME_KEY),
					AsyncStorage.getItem(STORAGE_PLAYBACK_RATE_KEY),
				]);

				// Restore settings
				if (savedRepeatStr) {
					const repeatMode = Number.parseInt(savedRepeatStr) as RepeatMode;
					set({ repeatMode });
					await TrackPlayer.setRepeatMode(repeatMode);
				}

				if (savedShuffleStr) {
					set({ isShuffled: savedShuffleStr === 'true' });
				}

				if (savedVolumeStr) {
					const volume = Number.parseFloat(savedVolumeStr);
					set({ volume });
					await TrackPlayer.setVolume(volume);
				}

				if (savedRateStr) {
					const rate = Number.parseFloat(savedRateStr);
					set({ playbackRate: rate });
					await TrackPlayer.setRate(rate);
				}

				// Restore queue and current song from IDs
				if (savedQueueStr && savedSongStr) {
					const parsed = JSON.parse(savedQueueStr);
					// Handle both old format (Song[]) and new format (string[])
					const queueIds: string[] = Array.isArray(parsed) && typeof parsed[0] === 'string'
						? parsed
						: Array.isArray(parsed) ? parsed.map((s: any) => s.id) : [];

					const queue = resolveIdsToSongs(queueIds);

					// Resolve current song — new format is plain ID, old format is JSON object
					let currentSong: Song | null = null;
					try {
						const songParsed = JSON.parse(savedSongStr);
						const songId = typeof songParsed === 'string' ? songParsed : songParsed?.id;
						if (songId) {
							const { useLibraryStore } = require('@/hooks/useLibraryStore');
							currentSong = useLibraryStore.getState().songsById[songId] || null;
						}
					} catch {
						// savedSongStr is a plain ID string (new format)
						const { useLibraryStore } = require('@/hooks/useLibraryStore');
						currentSong = useLibraryStore.getState().songsById[savedSongStr] || null;
					}

					if (queue.length > 0 && currentSong) {
						const position = savedPosStr ? Number(savedPosStr) : 0;

						// Restore original queue if available
						if (savedOriginalQueueStr) {
							const origParsed = JSON.parse(savedOriginalQueueStr);
							const origIds: string[] = Array.isArray(origParsed) && typeof origParsed[0] === 'string'
								? origParsed
								: Array.isArray(origParsed) ? origParsed.map((s: any) => s.id) : [];
							set({ originalQueue: resolveIdsToSongs(origIds) });
						}

						await TrackPlayer.add(queue.map(songToTrack));

						const trackIndex = queue.findIndex((s) => s.id === currentSong!.id);
						if (trackIndex !== -1) {
							await TrackPlayer.skip(trackIndex);
							if (position > 0) {
								await TrackPlayer.seekTo(position);
							}
						}

						const color = await extractArtworkColor(currentSong);

						set({
							currentSong,
							queue,
							position,
							artworkBgColor: color,
						});

						console.log('✅ Restored playback state');
					}
				}
			} catch (err) {
				console.warn('Failed to restore playback state:', err);
			}
		} catch (err) {
			console.error('Failed to initialize TrackPlayer:', err);
			set({ error: 'Failed to initialize audio player' });
		}
	},

	// Play sound
	playSound: async (song: Song, newQueue?: Song[]) => {
		return performanceMonitor.trackAsync('playSound', async () => {
			try {
				set({ error: null });

			const state = get();
			const currentQueue = await TrackPlayer.getQueue();

			// Optimized queue comparison - check if queue IDs match
			const currentQueueIds = currentQueue.map((t) => t.id);
			const newQueueIds = newQueue?.map((s) => s.id.toString()) || [];
			const isNewQueue =
				!newQueue ||
				currentQueue.length === 0 ||
				newQueue.length !== currentQueue.length ||
				!newQueueIds.every((id, idx) => id === currentQueueIds[idx]);

			if (isNewQueue && newQueue) {
				await TrackPlayer.reset();

				// Store the queue
				const queueToUse = state.isShuffled ? createShuffledQueue(newQueue, song) : newQueue;

				await TrackPlayer.add(queueToUse.map(songToTrack));

				const trackIndex = queueToUse.findIndex((t) => t.id === song.id);
				if (trackIndex !== -1) {
					await TrackPlayer.skip(trackIndex);
				}

				saveQueueState(queueToUse, newQueue, song);

				set({
					queue: queueToUse,
					originalQueue: newQueue,
				});
			} else if (newQueue) {
				// Same queue, just skip to the song - much faster path
				const trackIndex = currentQueue.findIndex((t) => t.id === song.id);
				if (trackIndex !== -1) {
					await TrackPlayer.skip(trackIndex);
				}
			} else {
				// Single song
				await TrackPlayer.reset();
				await TrackPlayer.add(songToTrack(song));
				set({ queue: [song], originalQueue: [song] });
			}

			// Update current song immediately for UI responsiveness
			set({ currentSong: song });
			
			saveCurrentSongId(song);
			AsyncStorage.removeItem(STORAGE_POSITION_KEY).catch(() => {});

			// Extract artwork color asynchronously (non-blocking)
			// Use InteractionManager to defer until after interactions complete
			InteractionManager.runAfterInteractions(() => {
				extractArtworkColor(song)
					.then((color) => {
						set({ artworkBgColor: color });
					})
					.catch((err) => {
						console.warn('Failed to extract artwork color:', err);
						set({ artworkBgColor: '#000' });
					});
			});

			// Start playback
			await TrackPlayer.play();
			} catch (error) {
				console.error('Error in playSound:', error);
				set({
					error: 'Failed to play song',
					currentSong: null,
					isPlaying: false,
					artworkBgColor: null,
				});
				AsyncStorage.removeItem(STORAGE_SONG_KEY).catch(() => {});
			}
		}, { songId: song.id, queueLength: newQueue?.length || 0 });
	},

	// Toggle play/pause
	togglePlayPause: async () => {
		try {
			const playbackState = await TrackPlayer.getPlaybackState();
			if (playbackState.state === State.Playing) {
				await TrackPlayer.pause();
			} else {
				await TrackPlayer.play();
			}
		} catch (error) {
			console.error('Error toggling play/pause:', error);
		}
	},

	// Skip to next
	skipToNext: async () => {
		return performanceMonitor.trackAsync('skipToNext', async () => {
			try {
			const state = get();
			if (!state.currentSong || state.queue.length === 0) return;

			const currentIndex = state.queue.findIndex((s) => s.id === state.currentSong!.id);
			if (currentIndex === -1) return;

			const nextIndex = (currentIndex + 1) % state.queue.length;
			const nextSong = state.queue[nextIndex];

			await TrackPlayer.skip(nextIndex);
			set({ currentSong: nextSong });

			saveCurrentSongId(nextSong);
			AsyncStorage.removeItem(STORAGE_POSITION_KEY).catch(() => {});

			extractArtworkColor(nextSong)
				.then((color) => set({ artworkBgColor: color }))
				.catch(() => set({ artworkBgColor: '#000' }));
			} catch (error) {
				console.error('Error skipping to next:', error);
			}
		});
	},

	// Skip to previous
	skipToPrevious: async () => {
		return performanceMonitor.trackAsync('skipToPrevious', async () => {
			try {
			const state = get();
			if (!state.currentSong || state.queue.length === 0) return;

			// If position >= 3s, restart current song
			if (state.position >= 3) {
				await TrackPlayer.seekTo(0);
				return;
			}

			const currentIndex = state.queue.findIndex((s) => s.id === state.currentSong!.id);
			if (currentIndex === -1) return;

			const prevIndex = currentIndex === 0 ? state.queue.length - 1 : currentIndex - 1;
			const prevSong = state.queue[prevIndex];

			await TrackPlayer.skip(prevIndex);
			set({ currentSong: prevSong });

			saveCurrentSongId(prevSong);
			AsyncStorage.removeItem(STORAGE_POSITION_KEY).catch(() => {});

			extractArtworkColor(prevSong)
				.then((color) => set({ artworkBgColor: color }))
				.catch(() => set({ artworkBgColor: '#000' }));
			} catch (error) {
				console.error('Error skipping to previous:', error);
			}
		});
	},

	// Seek to position
	seekTo: async (position: number) => {
		try {
			await TrackPlayer.seekTo(position);
			set({ position });
			await AsyncStorage.setItem(STORAGE_POSITION_KEY, String(position));
		} catch (error) {
			console.error('Error seeking:', error);
		}
	},

	// Add to queue
	addToQueue: async (songs: Song[]) => {
		try {
			const state = get();
			const newQueue = [...state.queue, ...songs];
			const newOriginalQueue = [...state.originalQueue, ...songs];

			await TrackPlayer.add(songs.map(songToTrack));

			set({ queue: newQueue, originalQueue: newOriginalQueue });
			saveQueueState(newQueue, newOriginalQueue, state.currentSong);
		} catch (error) {
			console.error('Error adding to queue:', error);
		}
	},

	// Play next (insert after current song)
	playNext: async (song: Song) => {
		try {
			const state = get();
			if (!state.currentSong) {
				await get().playSound(song, [song]);
				return;
			}

			const currentIndex = state.queue.findIndex((s) => s.id === state.currentSong!.id);
			if (currentIndex === -1) return;

			const newQueue = [...state.queue];
			newQueue.splice(currentIndex + 1, 0, song);

			const newOriginalQueue = [...state.originalQueue];
			const originalIndex = newOriginalQueue.findIndex((s) => s.id === state.currentSong!.id);
			if (originalIndex !== -1) {
				newOriginalQueue.splice(originalIndex + 1, 0, song);
			}

			// Get current TrackPlayer queue and insert the song
			const trackPlayerQueue = await TrackPlayer.getQueue();
			const trackPlayerIndex = trackPlayerQueue.findIndex((t) => t.id === state.currentSong!.id);
			if (trackPlayerIndex !== -1) {
				await TrackPlayer.add(songToTrack(song), trackPlayerIndex + 1);
			}

			set({ queue: newQueue, originalQueue: newOriginalQueue });
			saveQueueState(newQueue, newOriginalQueue, state.currentSong);
		} catch (error) {
			console.error('Error adding song to play next:', error);
		}
	},

	// Remove from queue
	removeFromQueue: (index: number) => {
		const state = get();
		if (index < 0 || index >= state.queue.length) return;

		const newQueue = [...state.queue];
		const removedSong = newQueue.splice(index, 1)[0];

		// Remove from original queue as well
		const newOriginalQueue = state.originalQueue.filter((s) => s.id !== removedSong.id);

		set({ queue: newQueue, originalQueue: newOriginalQueue });
		saveQueueState(newQueue, newOriginalQueue, state.currentSong);

		// Remove from TrackPlayer
		TrackPlayer.remove(index).catch((err) => console.warn('Failed to remove track:', err));
	},

	// Clear queue
	clearQueue: () => {
		const state = get();
		if (!state.currentSong) return;

		const newQueue = [state.currentSong];
		const newOriginalQueue = [state.currentSong];

		set({ queue: newQueue, originalQueue: newOriginalQueue });
		saveQueueState(newQueue, newOriginalQueue, state.currentSong);

		// Reset TrackPlayer queue
		TrackPlayer.reset()
			.then(() => TrackPlayer.add(songToTrack(state.currentSong!)))
			.catch((err) => console.warn('Failed to reset queue:', err));
	},

	// Reorder queue
	reorderQueue: (fromIndex: number, toIndex: number) => {
		const state = get();
		if (fromIndex < 0 || fromIndex >= state.queue.length || toIndex < 0 || toIndex >= state.queue.length) {
			return;
		}

		const newQueue = [...state.queue];
		const [movedSong] = newQueue.splice(fromIndex, 1);
		newQueue.splice(toIndex, 0, movedSong);

		set({ queue: newQueue });
		AsyncStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(newQueue.map((s) => s.id))).catch(() => {});

		// Reorder in TrackPlayer
		TrackPlayer.move(fromIndex, toIndex).catch((err) => console.warn('Failed to reorder track:', err));
	},

	// Get queue
	getQueue: () => get().queue,

	// Toggle repeat
	toggleRepeat: async () => {
		const state = get();
		const nextMode =
			state.repeatMode === RepeatMode.Off
				? RepeatMode.Track
				: state.repeatMode === RepeatMode.Track
					? RepeatMode.Queue
					: RepeatMode.Off;

		await TrackPlayer.setRepeatMode(nextMode);
		set({ repeatMode: nextMode });
		await AsyncStorage.setItem(STORAGE_REPEAT_MODE_KEY, String(nextMode));
	},

	// Toggle shuffle — swaps upcoming tracks without interrupting current playback
	toggleShuffle: async () => {
		const state = get();
		const newShuffleState = !state.isShuffled;

		let newQueue: Song[];

		if (newShuffleState) {
			newQueue = createShuffledQueue(state.originalQueue, state.currentSong);
		} else {
			newQueue = [...state.originalQueue];
		}

		set({ isShuffled: newShuffleState, queue: newQueue });

		// Swap upcoming tracks in TrackPlayer without resetting the current track
		try {
			const activeIndex = await TrackPlayer.getActiveTrackIndex();
			if (activeIndex != null) {
				// Remove everything after the current track
				await TrackPlayer.removeUpcomingTracks();

				// Find the current song in the new queue order
				const currentId = state.currentSong?.id;
				const newCurrentIdx = newQueue.findIndex((s) => s.id === currentId);

				// Add tracks that come after the current song in the new order
				const upcoming = newQueue.slice(newCurrentIdx + 1);
				// Also wrap around: tracks before the current song (for repeat-queue)
				const wrapped = newQueue.slice(0, newCurrentIdx);
				const tracksToAdd = [...upcoming, ...wrapped];

				if (tracksToAdd.length > 0) {
					await TrackPlayer.add(tracksToAdd.map(songToTrack));
				}
			}
		} catch (err) {
			console.warn('Failed to update TrackPlayer queue for shuffle:', err);
		}

		AsyncStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(newQueue.map((s) => s.id))).catch(() => {});
		AsyncStorage.setItem(STORAGE_SHUFFLE_KEY, String(newShuffleState)).catch(() => {});
	},

	// Set volume
	setVolume: async (volume: number) => {
		try {
			const clampedVolume = Math.max(0, Math.min(1, volume));
			await TrackPlayer.setVolume(clampedVolume);
			set({ volume: clampedVolume });
			await AsyncStorage.setItem(STORAGE_VOLUME_KEY, String(clampedVolume));
		} catch (error) {
			console.error('Error setting volume:', error);
		}
	},

	// Set playback rate
	setPlaybackRate: async (rate: number) => {
		try {
			const clampedRate = Math.max(0.5, Math.min(2.0, rate));
			await TrackPlayer.setRate(clampedRate);
			set({ playbackRate: clampedRate });
			await AsyncStorage.setItem(STORAGE_PLAYBACK_RATE_KEY, String(clampedRate));
		} catch (error) {
			console.error('Error setting playback rate:', error);
		}
	},
}));

// Hook to sync TrackPlayer events with the store
export function useTrackPlayerSync() {
	const playbackState = usePlaybackState();

	// Sync playing state - wrapped in useEffect to avoid setState during render
	React.useEffect(() => {
		const state = useAudioStore.getState();

		if (playbackState?.state === State.Playing && !state.isPlaying) {
			state._setIsPlaying(true);
		} else if (playbackState?.state !== State.Playing && state.isPlaying) {
			state._setIsPlaying(false);
		}

		// Handle buffering
		if (playbackState?.state === State.Buffering && !state.isBuffering) {
			state._setIsBuffering(true);
		} else if (playbackState?.state !== State.Buffering && state.isBuffering) {
			state._setIsBuffering(false);
		}
	}, [playbackState?.state]);

	useTrackPlayerEvents(
		[
			Event.PlaybackProgressUpdated,
			Event.PlaybackQueueEnded,
			Event.PlaybackActiveTrackChanged,
			Event.PlaybackError,
			Event.RemotePlay,
			Event.RemotePause,
			Event.RemoteNext,
			Event.RemotePrevious,
		],
		async (event) => {
			// Get fresh state for each event
			const state = useAudioStore.getState();

			if (event.type === Event.PlaybackProgressUpdated) {
				state._setPosition(event.position);
				state._setDuration(event.duration);
			}

			if (event.type === Event.PlaybackQueueEnded) {
				// Queue ended - TrackPlayer handles repeat modes automatically
				// This event fires when the queue truly ends (no repeat or track repeat finished)
				console.log('🎵 Queue ended, repeat mode:', state.repeatMode);
			}

			if (event.type === Event.PlaybackActiveTrackChanged) {
				// Use the event index + our Zustand queue — no native bridge calls needed
				const trackIndex = event.index;
				if (trackIndex == null || trackIndex < 0 || trackIndex >= state.queue.length) return;

				const newCurrentSong = state.queue[trackIndex];
				if (!newCurrentSong || newCurrentSong.id === state.currentSong?.id) return;

				state._setCurrentSong(newCurrentSong);

				// Persist & extract color asynchronously
				saveCurrentSongId(newCurrentSong);
				extractArtworkColor(newCurrentSong)
					.then((color) => useAudioStore.getState()._setArtworkBgColor(color))
					.catch(() => {});
			}

			if (event.type === Event.PlaybackError) {
				console.error('Playback error:', event);
				useAudioStore.setState({
					error: 'Playback error occurred',
					currentSong: null,
					isPlaying: false,
					artworkBgColor: null,
				});
				AsyncStorage.removeItem(STORAGE_SONG_KEY).catch(() => {});
			}

			if (event.type === Event.RemotePlay) {
				await TrackPlayer.play();
			}

			if (event.type === Event.RemotePause) {
				await TrackPlayer.pause();
			}

			if (event.type === Event.RemoteNext) {
				await state.skipToNext();
			}

			if (event.type === Event.RemotePrevious) {
				await state.skipToPrevious();
			}
		},
	);
}
