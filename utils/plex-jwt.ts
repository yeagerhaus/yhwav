import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportJWK, generateKeyPair, importJWK, SignJWT } from 'jose';
import { getClientId } from './client-id';

const PLEX_TOKEN = process.env.EXPO_PUBLIC_PLEX_TOKEN!; // Your existing token for initial registration

// Storage keys
const STORAGE_KEYS = {
	PRIVATE_KEY: 'plex_private_key',
	PUBLIC_KEY: 'plex_public_key',
	JWT_TOKEN: 'plex_jwt_token',
	TOKEN_EXPIRY: 'plex_token_expiry',
	JWK_REGISTERED: 'plex_jwk_registered',
} as const;

// JWT token expiry buffer (refresh 1 hour before expiry)
const TOKEN_REFRESH_BUFFER = 60 * 60 * 1000; // 1 hour in milliseconds

export interface PlexJWTPayload {
	nonce: string;
	scope: string;
	aud: 'plex.tv';
	iss: string;
	iat: number;
	exp: number;
	[key: string]: any; // Allow additional properties for JWT compatibility
}

export interface PlexNonceResponse {
	nonce: string;
}

export interface PlexTokenResponse {
	auth_token: string;
}

export interface PlexJWKResponse {
	success: boolean;
}

export class PlexJWTService {
	private static instance: PlexJWTService;
	private keyPair: CryptoKeyPair | null = null;
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
	 * Initialize the JWT service by loading or generating key pair
	 */
	async initialize(): Promise<void> {
		try {
			// Try to load existing key pair from storage
			const storedPrivateKey = await AsyncStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
			const storedPublicKey = await AsyncStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
			const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
			const storedExpiry = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

			if (storedPrivateKey && storedPublicKey) {
				// Import existing keys
				this.keyPair = {
					privateKey: (await importJWK(JSON.parse(storedPrivateKey), 'EdDSA')) as CryptoKey,
					publicKey: (await importJWK(JSON.parse(storedPublicKey), 'EdDSA')) as CryptoKey,
				};
				this.currentToken = storedToken;
				this.tokenExpiry = storedExpiry ? parseInt(storedExpiry, 10) : null;
			} else {
				// Generate new key pair
				await this.generateKeyPair();
			}

			// Check if we need to register the JWK or refresh the token
			const jwkRegistered = await AsyncStorage.getItem(STORAGE_KEYS.JWK_REGISTERED);
			if (!jwkRegistered) {
				await this.registerJWK();
			}

			// Check if token needs refresh
			if (this.needsTokenRefresh()) {
				await this.refreshToken();
			}
		} catch (error) {
			console.error('Failed to initialize Plex JWT service:', error);
			throw error;
		}
	}

	/**
	 * Get the current valid JWT token, refreshing if necessary
	 */
	async getValidToken(): Promise<string> {
		if (this.needsTokenRefresh()) {
			await this.refreshToken();
		}

		if (!this.currentToken) {
			throw new Error('No valid JWT token available');
		}

		return this.currentToken;
	}

	/**
	 * Generate a new ED25519 key pair
	 */
	private async generateKeyPair(): Promise<void> {
		this.keyPair = await generateKeyPair('EdDSA', {
			crv: 'Ed25519',
		});

		// Export and store the keys
		const privateKeyJWK = await exportJWK(this.keyPair.privateKey);
		const publicKeyJWK = await exportJWK(this.keyPair.publicKey);

		await AsyncStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, JSON.stringify(privateKeyJWK));
		await AsyncStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, JSON.stringify(publicKeyJWK));
	}

	/**
	 * Register the public key (JWK) with Plex
	 */
	private async registerJWK(): Promise<void> {
		if (!this.keyPair) {
			throw new Error('Key pair not initialized');
		}

		const publicKeyJWK = await exportJWK(this.keyPair.publicKey);

		const clientId = await getClientId();
		const response = await fetch('https://clients.plex.tv/api/v2/auth/jwk', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Plex-Client-Identifier': clientId,
				'X-Plex-Token': PLEX_TOKEN,
			},
			body: JSON.stringify({
				jwk: {
					kty: 'OKP',
					crv: 'Ed25519',
					x: publicKeyJWK.x,
					use: 'sig',
					alg: 'EdDSA',
				},
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to register JWK: ${response.status} ${errorText}`);
		}

		const result: PlexJWKResponse = await response.json();
		if (result.success) {
			await AsyncStorage.setItem(STORAGE_KEYS.JWK_REGISTERED, 'true');
		} else {
			throw new Error('JWK registration failed');
		}
	}

	/**
	 * Get a nonce from Plex
	 */
	private async getNonce(): Promise<string> {
		const clientId = await getClientId();
		const response = await fetch('https://clients.plex.tv/api/v2/auth/nonce', {
			method: 'GET',
			headers: {
				'X-Plex-Client-Identifier': clientId,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to get nonce: ${response.status} ${errorText}`);
		}

		const result: PlexNonceResponse = await response.json();
		return result.nonce;
	}

	/**
	 * Create and sign a device JWT
	 */
	private async createDeviceJWT(nonce: string): Promise<string> {
		if (!this.keyPair) {
			throw new Error('Key pair not initialized');
		}

		const clientId = await getClientId();
		const now = Math.floor(Date.now() / 1000);
		const payload: PlexJWTPayload = {
			nonce,
			scope: 'username,email,friendly_name,restricted,anonymous,joinedAt',
			aud: 'plex.tv',
			iss: clientId,
			iat: now,
			exp: now + 300, // 5 minutes
		};

		const jwt = await new SignJWT(payload).setProtectedHeader({ alg: 'EdDSA' }).sign(this.keyPair.privateKey);

		return jwt;
	}

	/**
	 * Exchange device JWT for Plex token
	 */
	private async exchangeForPlexToken(deviceJWT: string): Promise<string> {
		const clientId = await getClientId();
		const response = await fetch('https://clients.plex.tv/api/v2/auth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Plex-Client-Identifier': clientId,
			},
			body: JSON.stringify({
				jwt: deviceJWT,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to exchange JWT for token: ${response.status} ${errorText}`);
		}

		const result: PlexTokenResponse = await response.json();
		return result.auth_token;
	}

	/**
	 * Refresh the JWT token
	 */
	private async refreshToken(): Promise<void> {
		try {
			const nonce = await this.getNonce();
			const deviceJWT = await this.createDeviceJWT(nonce);
			const plexToken = await this.exchangeForPlexToken(deviceJWT);

			// Store the new token and expiry (7 days from now)
			const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

			this.currentToken = plexToken;
			this.tokenExpiry = expiry;

			await AsyncStorage.setItem(STORAGE_KEYS.JWT_TOKEN, plexToken);
			await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiry.toString());
		} catch (error) {
			console.error('Failed to refresh Plex JWT token:', error);
			throw error;
		}
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
		await AsyncStorage.multiRemove([
			STORAGE_KEYS.PRIVATE_KEY,
			STORAGE_KEYS.PUBLIC_KEY,
			STORAGE_KEYS.JWT_TOKEN,
			STORAGE_KEYS.TOKEN_EXPIRY,
			STORAGE_KEYS.JWK_REGISTERED,
		]);

		this.keyPair = null;
		this.currentToken = null;
		this.tokenExpiry = null;
	}

	/**
	 * Check if the service is properly initialized
	 */
	isInitialized(): boolean {
		return this.keyPair !== null && this.currentToken !== null;
	}
}

// Export singleton instance
export const plexJWTService = PlexJWTService.getInstance();
