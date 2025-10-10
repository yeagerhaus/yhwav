import AsyncStorage from '@react-native-async-storage/async-storage';

const PLEX_TOKEN = process.env.EXPO_PUBLIC_PLEX_TOKEN!; // Your existing token for initial registration

// Storage keys
const STORAGE_KEYS = {
	JWT_TOKEN: 'plex_jwt_token',
	TOKEN_EXPIRY: 'plex_token_expiry',
} as const;

// JWT token expiry buffer (refresh 1 hour before expiry)
const TOKEN_REFRESH_BUFFER = 60 * 60 * 1000; // 1 hour in milliseconds

export interface PlexTokenResponse {
	auth_token: string;
}

export class PlexJWTService {
	private static instance: PlexJWTService;
	private currentToken: string | null = null;
	private tokenExpiry: number | null = null;

	private constructor() {}

	static getInstance(): PlexJWTService {
		if (!PlexJWTService.instance) {
			PlexJWTService.instance = new PlexJWTService();
		}
		return PlexJWTService.instance;
	}

	/**
	 * Initialize the JWT service - simplified version that uses existing token
	 */
	async initialize(): Promise<void> {
		try {
			// For now, just use the existing Plex token
			// This is a simplified approach that avoids complex crypto operations
			this.currentToken = PLEX_TOKEN;
			this.tokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now

			console.log('Plex JWT service initialized with existing token');
		} catch (error) {
			console.error('Failed to initialize Plex JWT service:', error);
			throw error;
		}
	}

	/**
	 * Get the current valid JWT token
	 */
	async getValidToken(): Promise<string> {
		if (!this.currentToken) {
			throw new Error('No valid JWT token available');
		}

		return this.currentToken;
	}

	/**
	 * Check if the token needs to be refreshed
	 */
	private needsTokenRefresh(): boolean {
		if (!this.currentToken || !this.tokenExpiry) {
			return true;
		}

		const now = Date.now();
		const timeUntilExpiry = this.tokenExpiry - now;

		return timeUntilExpiry < TOKEN_REFRESH_BUFFER;
	}

	/**
	 * Clear all stored authentication data
	 */
	async clearAuth(): Promise<void> {
		await AsyncStorage.multiRemove([STORAGE_KEYS.JWT_TOKEN, STORAGE_KEYS.TOKEN_EXPIRY]);

		this.currentToken = null;
		this.tokenExpiry = null;
	}

	/**
	 * Check if the service is properly initialized
	 */
	isInitialized(): boolean {
		return this.currentToken !== null;
	}
}

// Export singleton instance
export const plexJWTService = PlexJWTService.getInstance();
