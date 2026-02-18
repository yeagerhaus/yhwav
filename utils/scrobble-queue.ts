import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Song } from '@/types';
import { scrobble } from '@/utils/plex';

const STORAGE_KEY = 'PENDING_SCROBBLES';

interface PendingScrobble {
	songId: string;
	title: string;
	timestamp: number;
}

let pending: PendingScrobble[] = [];
let flushing = false;

async function persist() {
	await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

async function hydrate() {
	try {
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		if (raw) pending = JSON.parse(raw);
	} catch {
		pending = [];
	}
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
			if (__DEV__) console.log(`✅ Flushed queued scrobble: ${entry.title}`);
			pending.shift();
		}
	} catch {
		// Network/offline — stop here, remaining entries stay queued
	} finally {
		await persist();
		flushing = false;
	}
}

/**
 * Queue a scrobble for a song. Attempts an immediate flush; if it fails the
 * entry is persisted to AsyncStorage and retried on next flush.
 */
export async function queueScrobble(song: Song): Promise<void> {
	pending.push({ songId: song.id, title: song.title, timestamp: Date.now() });
	await persist();

	const { useLibraryStore } = require('@/hooks/useLibraryStore');
	const { recentlyPlayed } = useLibraryStore.getState();
	const filtered = recentlyPlayed.filter((s: Song) => s.id !== song.id);
	useLibraryStore.getState().setRecentlyPlayed([song, ...filtered].slice(0, 25));

	await flushPendingScrobbles();
}

/**
 * Hydrate queue from disk and flush anything left over (call on app startup).
 */
export async function initScrobbleQueue(): Promise<void> {
	await hydrate();
	if (pending.length > 0 && __DEV__) {
		console.log(`📋 ${pending.length} pending scrobble(s) to flush`);
	}
	await flushPendingScrobbles();
}
