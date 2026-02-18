import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import type { Song } from '@/types/song';

const STORAGE_KEY = 'MUSIC_DOWNLOADS';

function safeSegment(id: string): string {
	return encodeURIComponent(id).replace(/%/g, '_').slice(0, 120);
}

function extensionFromUrl(url: string): string {
	try {
		const path = new URL(url).pathname;
		const ext = path.slice(path.lastIndexOf('.'));
		if (['.mp3', '.m4a', '.aac', '.ogg', '.wav', '.flac', '.alac'].includes(ext.toLowerCase())) return ext;
	} catch {}
	return '.mp3';
}

export interface MusicDownload {
	songId: string;
	localUri: string;
	title: string;
	artist: string;
	album: string;
	albumId?: string;
	artistKey?: string;
	artworkUrl?: string;
	downloadedAt: number;
}

interface QueueProgress {
	completed: number;
	total: number;
}

interface MusicDownloadsState {
	downloads: Record<string, MusicDownload>;
	downloading: Set<string>;
	queue: Song[];
	queueTotal: number;
	queueCompleted: number;
	hydrated: boolean;

	hydrate: () => Promise<void>;
	downloadTrack: (song: Song) => void;
	downloadTracks: (songs: Song[]) => void;
	removeDownload: (songId: string) => Promise<void>;
	removeDownloads: (songIds: string[]) => Promise<void>;
	cancelQueue: () => void;
	isDownloaded: (songId: string) => boolean;
	isDownloading: (songId: string) => boolean;
	isQueued: (songId: string) => boolean;
	getLocalUri: (songId: string) => string | undefined;
	getQueueProgress: () => QueueProgress;
}

let processing = false;

async function persistDownloads(downloads: Record<string, MusicDownload>) {
	await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(downloads)));
}

async function processQueue(get: () => MusicDownloadsState, set: (partial: Partial<MusicDownloadsState> | ((s: MusicDownloadsState) => Partial<MusicDownloadsState>)) => void) {
	if (processing) return;
	processing = true;

	try {
		while (true) {
			const { queue, downloads } = get();
			if (queue.length === 0) break;

			const song = queue[0];
			const remaining = queue.slice(1);
			set({ queue: remaining });

			if (downloads[song.id]) {
				set((s) => ({ queueCompleted: s.queueCompleted + 1 }));
				continue;
			}

			set((s) => ({ downloading: new Set(s.downloading).add(song.id) }));

			const dir = `${FileSystem.documentDirectory ?? ''}music`;
			const ext = extensionFromUrl(song.uri || song.streamUrl || '');
			const filename = `${safeSegment(song.id)}${ext}`;
			const localPath = `${dir}/${filename}`;

			try {
				await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
				const { uri } = await FileSystem.downloadAsync(song.uri || song.streamUrl || '', localPath);

				const entry: MusicDownload = {
					songId: song.id,
					localUri: uri,
					title: song.title,
					artist: song.artist,
					album: song.album,
					artistKey: song.artistKey,
					artworkUrl: song.artworkUrl,
					downloadedAt: Date.now(),
				};

				const next = { ...get().downloads, [song.id]: entry };
				set((s) => {
					const d = new Set(s.downloading);
					d.delete(song.id);
					return { downloads: next, downloading: d, queueCompleted: s.queueCompleted + 1 };
				});
				await persistDownloads(next);
			} catch (err) {
				console.warn(`Music download failed for ${song.title}:`, err);
				set((s) => {
					const d = new Set(s.downloading);
					d.delete(song.id);
					return { downloading: d, queueCompleted: s.queueCompleted + 1 };
				});
			}
		}
	} finally {
		processing = false;
		set({ queueTotal: 0, queueCompleted: 0 });
	}
}

export const useMusicDownloadsStore = create<MusicDownloadsState>((set, get) => ({
	downloads: {},
	downloading: new Set(),
	queue: [],
	queueTotal: 0,
	queueCompleted: 0,
	hydrated: false,

	hydrate: async () => {
		try {
			const raw = await AsyncStorage.getItem(STORAGE_KEY);
			if (!raw) {
				set({ hydrated: true });
				return;
			}
			const list: MusicDownload[] = JSON.parse(raw);
			const downloads: Record<string, MusicDownload> = {};
			for (const d of list) downloads[d.songId] = d;
			set({ downloads, hydrated: true });
		} catch {
			set({ hydrated: true });
		}
	},

	downloadTrack: (song: Song) => {
		const { downloads, downloading, queue } = get();
		if (downloads[song.id] || downloading.has(song.id) || queue.some((s) => s.id === song.id)) return;
		set((s) => ({
			queue: [...s.queue, song],
			queueTotal: s.queueTotal + 1,
		}));
		processQueue(get, set);
	},

	downloadTracks: (songs: Song[]) => {
		const { downloads, downloading, queue } = get();
		const queueIds = new Set(queue.map((s) => s.id));
		const newSongs = songs.filter((s) => !downloads[s.id] && !downloading.has(s.id) && !queueIds.has(s.id));
		if (newSongs.length === 0) return;
		set((s) => ({
			queue: [...s.queue, ...newSongs],
			queueTotal: s.queueTotal + newSongs.length,
		}));
		processQueue(get, set);
	},

	removeDownload: async (songId: string) => {
		const { downloads } = get();
		const entry = downloads[songId];
		if (!entry) return;

		try {
			await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
		} catch {}

		const next = { ...downloads };
		delete next[songId];
		set({ downloads: next });
		await persistDownloads(next);
	},

	removeDownloads: async (songIds: string[]) => {
		const { downloads } = get();
		const next = { ...downloads };
		for (const id of songIds) {
			const entry = next[id];
			if (entry) {
				try {
					await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
				} catch {}
				delete next[id];
			}
		}
		set({ downloads: next });
		await persistDownloads(next);
	},

	cancelQueue: () => {
		set({ queue: [], queueTotal: 0, queueCompleted: 0 });
	},

	isDownloaded: (songId: string) => !!get().downloads[songId],
	isDownloading: (songId: string) => get().downloading.has(songId),
	isQueued: (songId: string) => get().queue.some((s) => s.id === songId),
	getLocalUri: (songId: string) => get().downloads[songId]?.localUri,

	getQueueProgress: () => {
		const { queueTotal, queueCompleted } = get();
		return { completed: queueCompleted, total: queueTotal };
	},
}));
