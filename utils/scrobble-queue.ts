import { storage } from '@/lib/storage';
import type { Playlist, Song } from '@/types';
import { scrobble } from '@/utils/plex';

const STORAGE_KEY = 'PENDING_SCROBBLES';

interface PendingScrobble {
	songId: string;
	title: string;
	timestamp: number;
	playlistRatingKey?: string;
}

let pending: PendingScrobble[] = [];
let flushing = false;

function persist() {
	storage.set(STORAGE_KEY, JSON.stringify(pending));
}

function hydrate() {
	try {
		const raw = storage.getString(STORAGE_KEY);
		if (raw) pending = JSON.parse(raw);
	} catch {
		pending = [];
	}
}

function optimisticPlaylistUpdate(playlistRatingKey: string) {
	const { useLibraryStore } = require('@/hooks/useLibraryStore');
	const playlists: Playlist[] = useLibraryStore.getState().playlists;
	const now = Math.floor(Date.now() / 1000);
	const updated = playlists.map((p: Playlist) => (p.ratingKey === playlistRatingKey ? { ...p, lastViewedAt: now } : p));
	useLibraryStore.getState().setPlaylists(updated);
}

/**
 * Flush all pending scrobbles to Plex. Entries that succeed are removed;
 * on the first failure we stop and persist the remainder for next time.
 */
export async function flushPendingScrobbles(): Promise<void> {
	if (flushing || pending.length === 0) return;
	flushing = true;
	try {
		while (pending.length > 0) {
			const entry = pending[0];
			await scrobble(entry.songId);
			if (entry.playlistRatingKey) {
				await scrobble(entry.playlistRatingKey).catch(() => {});
			}
			pending.shift();
		}
	} catch {
		// Network/offline — stop here, remaining entries stay queued
	} finally {
		persist();
		flushing = false;
	}
}

/**
 * Queue a scrobble for a song. Attempts an immediate flush; if it fails the
 * entry is persisted to MMKV and retried on next flush.
 */
export async function queueScrobble(song: Song): Promise<void> {
	const { useAudioStore } = require('@/hooks/useAudioStore');
	const playlistRatingKey: string | null = useAudioStore.getState().currentPlaylistRatingKey;

	pending.push({
		songId: song.id,
		title: song.title,
		timestamp: Date.now(),
		playlistRatingKey: playlistRatingKey ?? undefined,
	});
	persist();

	const { useLibraryStore } = require('@/hooks/useLibraryStore');
	const { recentlyPlayed } = useLibraryStore.getState();
	const filtered = recentlyPlayed.filter((s: Song) => s.id !== song.id);
	useLibraryStore.getState().setRecentlyPlayed([song, ...filtered].slice(0, 25));

	if (playlistRatingKey) optimisticPlaylistUpdate(playlistRatingKey);

	await flushPendingScrobbles();
}

/**
 * Hydrate queue from disk and flush anything left over (call on app startup).
 */
export async function initScrobbleQueue(): Promise<void> {
	hydrate();
	if (pending.length > 0 && __DEV__) {
		console.log(`📋 ${pending.length} pending scrobble(s) to flush`);
	}
	await flushPendingScrobbles();
}
