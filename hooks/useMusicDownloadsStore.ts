import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import type { Album } from '@/types/album';
import type { Artist } from '@/types/artist';
import type { Playlist } from '@/types/playlist';
import type { Song } from '@/types/song';

const STORAGE_KEY = 'MUSIC_DOWNLOADS';
const PLAYLISTS_STORAGE_KEY = 'MUSIC_DOWNLOAD_PLAYLISTS';
const ARTISTS_STORAGE_KEY = 'MUSIC_DOWNLOAD_ARTISTS';
const ALBUMS_STORAGE_KEY = 'MUSIC_DOWNLOAD_ALBUMS';

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

export interface DownloadedPlaylist {
	id: string;
	key: string;
	ratingKey: string;
	title: string;
	summary?: string;
	artworkUrl?: string;
	playlistType: 'audio' | 'video' | 'photo';
	leafCount?: number;
	songs: Song[];
	downloadedAt: number;
}

interface QueueProgress {
	completed: number;
	total: number;
}

interface MusicDownloadsState {
	downloads: Record<string, MusicDownload>;
	downloadedPlaylists: Record<string, DownloadedPlaylist>;
	downloadedArtists: Record<string, Artist>;
	downloadedAlbums: Record<string, Album>;
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

	savePlaylistForOffline: (playlist: Playlist, songs: Song[]) => Promise<void>;
	removePlaylistForOffline: (playlistKey: string) => Promise<void>;
	getOfflinePlaylist: (playlistKey: string) => DownloadedPlaylist | undefined;

	saveArtistForOffline: (artist: Artist) => Promise<void>;
	saveAlbumForOffline: (album: Album) => Promise<void>;
	snapshotMetadataForSongs: (songs: Song[]) => Promise<void>;
	removeAllDownloads: () => Promise<void>;
}

let processing = false;

async function persistDownloads(downloads: Record<string, MusicDownload>) {
	await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(downloads)));
}

async function persistPlaylists(playlists: Record<string, DownloadedPlaylist>) {
	await AsyncStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(Object.values(playlists)));
}

async function persistArtists(artists: Record<string, Artist>) {
	await AsyncStorage.setItem(ARTISTS_STORAGE_KEY, JSON.stringify(Object.values(artists)));
}

async function persistAlbums(albums: Record<string, Album>) {
	await AsyncStorage.setItem(ALBUMS_STORAGE_KEY, JSON.stringify(Object.values(albums)));
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
	downloadedPlaylists: {},
	downloadedArtists: {},
	downloadedAlbums: {},
	downloading: new Set(),
	queue: [],
	queueTotal: 0,
	queueCompleted: 0,
	hydrated: false,

	hydrate: async () => {
		try {
			const [rawDownloads, rawPlaylists, rawArtists, rawAlbums] = await Promise.all([
				AsyncStorage.getItem(STORAGE_KEY),
				AsyncStorage.getItem(PLAYLISTS_STORAGE_KEY),
				AsyncStorage.getItem(ARTISTS_STORAGE_KEY),
				AsyncStorage.getItem(ALBUMS_STORAGE_KEY),
			]);

			const downloads: Record<string, MusicDownload> = {};
			if (rawDownloads) {
				const list: MusicDownload[] = JSON.parse(rawDownloads);
				for (const d of list) downloads[d.songId] = d;
			}

			const downloadedPlaylists: Record<string, DownloadedPlaylist> = {};
			if (rawPlaylists) {
				const list: DownloadedPlaylist[] = JSON.parse(rawPlaylists);
				for (const p of list) downloadedPlaylists[p.key] = p;
			}

			const downloadedArtists: Record<string, Artist> = {};
			if (rawArtists) {
				const list: Artist[] = JSON.parse(rawArtists);
				for (const a of list) downloadedArtists[a.key] = a;
			}

			const downloadedAlbums: Record<string, Album> = {};
			if (rawAlbums) {
				const list: Album[] = JSON.parse(rawAlbums);
				for (const a of list) downloadedAlbums[a.id] = a;
			}

			set({ downloads, downloadedPlaylists, downloadedArtists, downloadedAlbums, hydrated: true });
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
		get().snapshotMetadataForSongs([song]);
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
		get().snapshotMetadataForSongs(songs);
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

	savePlaylistForOffline: async (playlist: Playlist, songs: Song[]) => {
		const entry: DownloadedPlaylist = {
			id: playlist.id,
			key: playlist.key,
			ratingKey: playlist.ratingKey,
			title: playlist.title,
			summary: playlist.summary,
			artworkUrl: playlist.artworkUrl,
			playlistType: playlist.playlistType,
			leafCount: songs.length,
			songs,
			downloadedAt: Date.now(),
		};
		const next = { ...get().downloadedPlaylists, [playlist.key]: entry };
		set({ downloadedPlaylists: next });
		await persistPlaylists(next);
	},

	removePlaylistForOffline: async (playlistKey: string) => {
		const next = { ...get().downloadedPlaylists };
		delete next[playlistKey];
		set({ downloadedPlaylists: next });
		await persistPlaylists(next);
	},

	getOfflinePlaylist: (playlistKey: string) => get().downloadedPlaylists[playlistKey],

	saveArtistForOffline: async (artist: Artist) => {
		const next = { ...get().downloadedArtists, [artist.key]: artist };
		set({ downloadedArtists: next });
		await persistArtists(next);
	},

	saveAlbumForOffline: async (album: Album) => {
		const next = { ...get().downloadedAlbums, [album.id]: album };
		set({ downloadedAlbums: next });
		await persistAlbums(next);
	},

	snapshotMetadataForSongs: async (songs: Song[]) => {
		console.log(`[snapshot] called with ${songs.length} songs`);
		const { useLibraryStore } = require('@/hooks/useLibraryStore');
		const libState = useLibraryStore.getState() as {
			artistsById: Record<string, Artist>;
			artists: Artist[];
			albumsById: Record<string, Album>;
		};
		const { artistsById, artists, albumsById } = libState;

		console.log(`[snapshot] library has ${Object.keys(artistsById).length} artistsById, ${artists.length} artists array, ${Object.keys(albumsById).length} albumsById`);
		if (artists.length > 0) {
			console.log(`[snapshot] sample artist keys from artistsById:`, Object.keys(artistsById).slice(0, 5));
		}

		const { downloadedArtists, downloadedAlbums } = get();
		console.log(`[snapshot] already have ${Object.keys(downloadedArtists).length} downloadedArtists, ${Object.keys(downloadedAlbums).length} downloadedAlbums`);

		let artistsChanged = false;
		let albumsChanged = false;
		const nextArtists = { ...downloadedArtists };
		const nextAlbums = { ...downloadedAlbums };

		const seenArtistKeys = new Set<string>();
		const seenAlbumKeys = new Set<string>();

		for (const song of songs) {
			if (song.artistKey && !seenArtistKeys.has(song.artistKey)) {
				seenArtistKeys.add(song.artistKey);
				console.log(`[snapshot] song "${song.title}" artistKey="${song.artistKey}" artist="${song.artist}"`);

				let artist: Artist | undefined = artistsById[song.artistKey];
				console.log(`[snapshot]   direct lookup artistsById["${song.artistKey}"]: ${artist ? artist.name : 'MISS'}`);

				if (!artist) {
					const ratingKey = song.artistKey.split('/').pop() || song.artistKey;
					artist = artistsById[ratingKey];
					console.log(`[snapshot]   ratingKey lookup artistsById["${ratingKey}"]: ${artist ? artist.name : 'MISS'}`);
				}
				if (!artist) {
					artist = artists.find((a) => a.name === song.artist);
					console.log(`[snapshot]   name lookup for "${song.artist}": ${artist ? `found key=${artist.key}` : 'MISS'}`);
				}
				if (artist) {
					if (!nextArtists[artist.key]) {
						console.log(`[snapshot]   ✅ saving artist key="${artist.key}" name="${artist.name}" thumb=${!!artist.thumb} art=${!!(artist as any).art}`);
						nextArtists[artist.key] = artist;
						artistsChanged = true;
					} else {
						console.log(`[snapshot]   already saved artist key="${artist.key}"`);
					}
				} else {
					console.log(`[snapshot]   ❌ could not find artist for song "${song.title}"`);
				}
			}

			const albumKey = `${song.album}\0${song.artist}`;
			if (!seenAlbumKeys.has(albumKey)) {
				seenAlbumKeys.add(albumKey);
				const album = Object.values(albumsById).find(
					(a) => a.title === song.album && a.artist === song.artist,
				);
				if (album && !nextAlbums[album.id]) {
					console.log(`[snapshot]   ✅ saving album id="${album.id}" title="${album.title}"`);
					nextAlbums[album.id] = album;
					albumsChanged = true;
				}
			}
		}

		console.log(`[snapshot] result: artistsChanged=${artistsChanged} albumsChanged=${albumsChanged}`);
		if (artistsChanged || albumsChanged) {
			set({
				...(artistsChanged ? { downloadedArtists: nextArtists } : {}),
				...(albumsChanged ? { downloadedAlbums: nextAlbums } : {}),
			});
			if (artistsChanged) await persistArtists(nextArtists);
			if (albumsChanged) await persistAlbums(nextAlbums);
			console.log(`[snapshot] persisted ${Object.keys(nextArtists).length} artists, ${Object.keys(nextAlbums).length} albums`);
		}
	},

	removeAllDownloads: async () => {
		const { downloads } = get();
		for (const entry of Object.values(downloads)) {
			try {
				await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
			} catch {}
		}
		set({
			downloads: {},
			downloadedPlaylists: {},
			downloadedArtists: {},
			downloadedAlbums: {},
			downloading: new Set(),
			queue: [],
			queueTotal: 0,
			queueCompleted: 0,
		});
		await persistDownloads({});
		await persistPlaylists({});
		await persistArtists({});
		await persistAlbums({});
	},
}));
