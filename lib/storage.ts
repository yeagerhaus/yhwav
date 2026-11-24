import { getRandomBytes } from 'expo-crypto';
import { createMMKV, deleteMMKV, existsMMKV, type MMKV } from 'react-native-mmkv';
import { getSecret, setSecret } from '@/lib/secureStorage';

/** Small app settings and state. */
export const storage = createMMKV();

const LIBRARY_STORAGE_ID = 'library-cache';
const LIBRARY_KEY_SECRET = 'library_cache_encryption_key';

let libraryStorage: MMKV | null = null;

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Dedicated, encrypted (AES-256) MMKV instance for the large library cache, kept separate from the small
 * settings in `storage` so the big blobs don't bloat the default memory-mapped file. The key lives in the
 * Keychain. Returns null if the Keychain is unavailable (e.g. a background task before first unlock).
 */
export function getLibraryStorage(): MMKV | null {
	if (libraryStorage) return libraryStorage;

	let key = getSecret(LIBRARY_KEY_SECRET);
	if (!key) {
		// New key: any existing file was written with a key we no longer have, so start clean.
		if (existsMMKV(LIBRARY_STORAGE_ID)) deleteMMKV(LIBRARY_STORAGE_ID);
		key = toHex(getRandomBytes(16)); // 32 hex chars = 256-bit key material
		if (!setSecret(LIBRARY_KEY_SECRET, key)) return null;
	}

	libraryStorage = createMMKV({ id: LIBRARY_STORAGE_ID, encryptionKey: key, encryptionType: 'AES-256' });
	return libraryStorage;
}
