import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CLIENT_ID_KEY = 'plex_client_id';

/**
 * Generate a unique client ID for this device installation
 * Format: yhplayer-{platform}-{timestamp}-{random}
 * Example: yhplayer-ios-1703123456789-a1b2c3d4
 */
export const generateClientId = (): string => {
	const platform = Platform.OS;
	const timestamp = Date.now();
	const random = Math.random().toString(36).substr(2, 8);
	
	return `yhplayer-${platform}-${timestamp}-${random}`;
};

/**
 * Get or create a unique client ID for this device
 * The ID is generated once per device installation and stored persistently
 */
export const getClientId = async (): Promise<string> => {
	try {
		// Try to get existing client ID
		const existingId = await AsyncStorage.getItem(CLIENT_ID_KEY);
		
		if (existingId) {
			return existingId;
		}
		
		// Generate new client ID
		const newId = generateClientId();
		
		// Store it for future use
		await AsyncStorage.setItem(CLIENT_ID_KEY, newId);
		
		console.log('Generated new Plex client ID:', newId);
		return newId;
	} catch (error) {
		console.error('Failed to get/generate client ID:', error);
		// Fallback to a basic ID if storage fails
		return generateClientId();
	}
};

/**
 * Clear the stored client ID (useful for testing or reset)
 */
export const clearClientId = async (): Promise<void> => {
	try {
		await AsyncStorage.removeItem(CLIENT_ID_KEY);
		console.log('Cleared Plex client ID');
	} catch (error) {
		console.error('Failed to clear client ID:', error);
	}
};
