import * as SecureStore from 'expo-secure-store';

/**
 * Keychain-backed storage for secrets (Plex token, MMKV encryption keys).
 *
 * AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: readable by background tasks once the device has been unlocked
 * after boot, and never migrated to another device via backups.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
	keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export function getSecret(key: string): string | null {
	try {
		return SecureStore.getItem(key, OPTIONS);
	} catch (error) {
		console.warn(`Keychain read failed for ${key}:`, error);
		return null;
	}
}

export function setSecret(key: string, value: string): boolean {
	try {
		SecureStore.setItem(key, value, OPTIONS);
		return true;
	} catch (error) {
		console.warn(`Keychain write failed for ${key}:`, error);
		return false;
	}
}

export async function deleteSecret(key: string): Promise<void> {
	try {
		await SecureStore.deleteItemAsync(key, OPTIONS);
	} catch (error) {
		console.warn(`Keychain delete failed for ${key}:`, error);
	}
}
