import { fetch } from 'expo/fetch';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getIsOfflineMode } from '@/hooks/useOfflineModeStore';
import { deleteSecret, getSecret, setSecret } from '@/lib/secureStorage';
import { storage } from '@/lib/storage';
import { type PlexServer, plexDiscoveryService } from './plex-discovery';
import { buildPlexIdentityHeaders } from './plex-identity';

export interface PlexAuthState {
	isAuthenticated: boolean;
	username?: string;
	email?: string;
	avatarUrl?: string;
	servers: PlexServer[];
	selectedServer?: PlexServer;
	accessToken?: string;
}

export interface PlexLoginResult {
	success: boolean;
	authState?: PlexAuthState;
	error?: string;
}

export interface PlexPinResult {
	success: boolean;
	pinId?: number;
	pinCode?: string;
	error?: string;
}

export interface PlexPinStatus {
	authToken?: string;
	expiresAt?: string;
	code?: string;
}

/** Keychain key for the Plex token. The rest of the auth state lives in MMKV without the token. */
const TOKEN_SECRET_KEY = 'plex_access_token';
const AUTH_STATE_KEY = 'plex_auth_state';

type UserInfoResult =
	| { status: 'valid'; user: { username: string; email: string; avatarUrl?: string } }
	| { status: 'invalid' }
	| { status: 'unreachable' };

export class PlexAuthService {
	private static instance: PlexAuthService;
	private authState: PlexAuthState = {
		isAuthenticated: false,
		servers: [],
	};
	private serverChangeListeners = new Set<() => void>();

	private constructor() {
		// Make the stored server/token available immediately (no network) so stores that hydrate before the
		// root init runs can resolve cached Plex URLs.
		this.loadStoredAuthState();
	}

	static getInstance(): PlexAuthService {
		if (!PlexAuthService.instance) {
			PlexAuthService.instance = new PlexAuthService();
		}
		return PlexAuthService.instance;
	}

	/**
	 * Get or create a unique client identifier for this device (async version)
	 */
	private getOrCreateClientIdentifierFromStorage(): string {
		const storageKey = 'plex_client_identifier';
		try {
			const stored = storage.getString(storageKey);
			if (stored) {
				return stored;
			}

			const platform = Platform.OS;
			const timestamp = Date.now();
			const random = Math.random().toString(36).substring(2, 10);
			const identifier = `rite-${platform}-${timestamp}-${random}`;

			storage.set(storageKey, identifier);
			return identifier;
		} catch (error) {
			console.error('Failed to get/create client identifier:', error);
			return `rite-${Platform.OS}-${Date.now()}`;
		}
	}

	/**
	 * Stable Plex client id for this install (persisted). Use for all Plex API and PMS requests.
	 */
	getClientIdentifier(): string {
		return this.getOrCreateClientIdentifierFromStorage();
	}

	/**
	 * Subscribe to sign-in, sign-out, and selected-server changes. Returns an unsubscribe fn.
	 */
	onServerChange(listener: () => void): () => void {
		this.serverChangeListeners.add(listener);
		return () => {
			this.serverChangeListeners.delete(listener);
		};
	}

	private notifyServerChange(): void {
		for (const listener of this.serverChangeListeners) {
			try {
				listener();
			} catch (error) {
				console.error('Server change listener failed:', error);
			}
		}
	}

	/**
	 * Request a PIN from Plex API for OAuth authentication
	 * Uses the /api/v2/pins endpoint (doesn't require JWT/key registration)
	 */
	async requestPlexPin(): Promise<PlexPinResult> {
		try {
			console.log('🔐 Requesting Plex PIN...');

			const response = await fetch('https://plex.tv/api/v2/pins', {
				method: 'POST',
				headers: {
					...buildPlexIdentityHeaders(this.getClientIdentifier()),
					Accept: 'application/json',
				},
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Unknown error');
				console.error(`❌ PIN request failed: ${response.status} - ${errorText}`);

				return {
					success: false,
					error: `Failed to request PIN: ${response.status} ${errorText}`,
				};
			}

			// v2 API returns JSON
			const data = await response.json();
			const pinId = data.id;
			const pinCode = data.code;

			if (!pinId || !pinCode) {
				throw new Error('Invalid response format from Plex API');
			}

			// console.log(`✅ PIN requested: ${pinCode} (ID: ${pinId})`);

			return {
				success: true,
				pinId,
				pinCode,
			};
		} catch (error: any) {
			console.error('❌ Failed to request PIN:', error);
			return {
				success: false,
				error: `Failed to request PIN: ${error.message}`,
			};
		}
	}

	/**
	 * Check PIN status and get auth token if authorized
	 * Uses the older /api/pins endpoint which doesn't require JWT/key registration
	 */
	async pollPinStatus(pinId: number): Promise<PlexPinStatus | null> {
		try {
			const response = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
				method: 'GET',
				headers: {
					...buildPlexIdentityHeaders(this.getClientIdentifier()),
					Accept: 'application/json',
				},
			});

			if (!response.ok) {
				return null;
			}

			// v2 API returns JSON
			const data = await response.json();

			// Only return if we have an auth token (PIN was authorized)
			if (data.authToken) {
				return {
					authToken: data.authToken,
					expiresAt: data.expiresAt,
					code: data.code,
				};
			}

			return null;
		} catch (error) {
			console.error('Failed to poll PIN status:', error);
			return null;
		}
	}

	/**
	 * Open Plex activation page in browser
	 */
	async openPlexActivation(pinCode: string): Promise<void> {
		const activationUrl = `https://plex.tv/link/?pin=${pinCode}`;
		await WebBrowser.openBrowserAsync(activationUrl);
	}

	/**
	 * Login with PIN-based OAuth flow
	 */
	async loginWithPin(
		onPinReceived?: (pinCode: string) => void,
		onStatusUpdate?: (status: string) => void,
		signal?: AbortSignal,
	): Promise<PlexLoginResult> {
		const cancelled: PlexLoginResult = { success: false, error: 'cancelled' };
		try {
			onStatusUpdate?.('Requesting PIN...');
			const pinResult = await this.requestPlexPin();

			if (!pinResult.success || !pinResult.pinId || !pinResult.pinCode) {
				return {
					success: false,
					error: pinResult.error || 'Failed to request PIN',
				};
			}

			if (signal?.aborted) return cancelled;
			onPinReceived?.(pinResult.pinCode);
			onStatusUpdate?.('Opening browser for authorization...');

			// Open browser for user to authorize
			await this.openPlexActivation(pinResult.pinCode);

			onStatusUpdate?.('Waiting for authorization...');

			// Poll for authorization (up to 5 minutes)
			const maxAttempts = 150; // 5 minutes at 2 seconds per attempt
			const pollInterval = 2000; // 2 seconds

			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				await new Promise((resolve) => setTimeout(resolve, pollInterval));
				// Stop polling plex.tv once the user has left the sign-in screen.
				if (signal?.aborted) return cancelled;

				const pinStatus = await this.pollPinStatus(pinResult.pinId);
				if (pinStatus?.authToken) {
					onStatusUpdate?.('Authorization successful! Connecting...');
					// Use the token to complete login
					return await this.loginWithToken(pinStatus.authToken);
				}

				// Update status every 10 seconds
				if (attempt % 5 === 0) {
					const remainingSeconds = Math.floor((maxAttempts - attempt) * (pollInterval / 1000));
					onStatusUpdate?.(`Waiting for authorization... (${remainingSeconds}s remaining)`);
				}
			}

			return {
				success: false,
				error: 'PIN authorization timed out. Please try again.',
			};
		} catch (error: any) {
			console.error('❌ PIN login failed:', error);
			return {
				success: false,
				error: `PIN login failed: ${error.message}`,
			};
		}
	}

	/**
	 * Login with Plex token and discover servers
	 */
	async loginWithToken(plexToken: string): Promise<PlexLoginResult> {
		try {
			console.log('🔐 Logging in with Plex token...');

			// First, verify the token by getting user info
			const userResult = await this.getUserInfo(plexToken);
			if (userResult.status === 'invalid') {
				return {
					success: false,
					error: 'Invalid Plex token. Please check your token and try again.',
				};
			}
			if (userResult.status === 'unreachable') {
				return {
					success: false,
					error: 'Could not reach plex.tv. Check your connection and try again.',
				};
			}
			const userInfo = userResult.user;

			// Discover available servers
			const discoveryResult = await plexDiscoveryService.discoverServers(plexToken);
			if (!discoveryResult.servers.length) {
				return {
					success: false,
					error: discoveryResult.error || 'No Plex servers found. Please check your server is running and accessible.',
				};
			}

			// Pick a server that actually answers. Select the server object itself; never copy fields from one
			// server onto another (that left duplicate ids and a wrong name/connection list).
			let recommendedServer = discoveryResult.recommendedServer;
			if (recommendedServer && !(await plexDiscoveryService.testServerConnection(recommendedServer, plexToken))) {
				console.warn('⚠️ Recommended server connection failed, trying other servers...');
				for (const server of discoveryResult.servers) {
					if (server.id === recommendedServer.id) continue;
					if (await plexDiscoveryService.testServerConnection(server, plexToken)) {
						recommendedServer = server;
						break;
					}
				}
			}

			// Signing into a different account without logging out: drop the previous account's data.
			const previousUsername = this.authState.username;
			if (this.authState.isAuthenticated && previousUsername && previousUsername !== userInfo.username) {
				const { resetUserData } = require('@/utils/session-reset');
				await resetUserData();
			}

			// Update auth state
			this.authState = {
				isAuthenticated: true,
				username: userInfo.username,
				email: userInfo.email,
				avatarUrl: userInfo.avatarUrl,
				servers: discoveryResult.servers,
				selectedServer: recommendedServer,
				accessToken: plexToken,
			};

			// Save to storage
			this.saveAuthState();
			this.notifyServerChange();

			// console.log('✅ Login successful!');
			console.log(`   User: ${userInfo.username}`);
			console.log(`   Servers: ${discoveryResult.servers.length}`);
			console.log(`   Selected: ${recommendedServer?.name || 'None'}`);

			return {
				success: true,
				authState: this.authState,
			};
		} catch (error: any) {
			console.error('❌ Login failed:', error);
			return {
				success: false,
				error: `Login failed: ${error.message}`,
			};
		}
	}

	/**
	 * Get user information from Plex API (username, email, avatar).
	 * Distinguishes a rejected token (401/403) from plex.tv being unreachable (network error / 5xx),
	 * so callers only sign the user out when the token is actually invalid.
	 */
	private async getUserInfo(plexToken: string): Promise<UserInfoResult> {
		let response: Awaited<ReturnType<typeof fetch>>;
		try {
			response = await fetch('https://plex.tv/api/v2/user', {
				method: 'GET',
				headers: {
					'X-Plex-Token': plexToken,
					Accept: 'application/json',
				},
			});
		} catch (error) {
			console.warn('Plex user check failed (unreachable):', error);
			return { status: 'unreachable' };
		}

		if (response.status === 401 || response.status === 403) {
			return { status: 'invalid' };
		}
		if (!response.ok) {
			return { status: 'unreachable' };
		}

		try {
			const data = await response.json();
			let avatarUrl: string | undefined = data.thumb;

			// /api/v2/user may not include thumb; /api/v2/home/user does
			if (!avatarUrl) {
				try {
					const homeRes = await fetch('https://plex.tv/api/v2/home/user', {
						method: 'GET',
						headers: {
							'X-Plex-Token': plexToken,
							Accept: 'application/json',
						},
					});
					if (homeRes.ok) {
						const homeData = await homeRes.json();
						avatarUrl = homeData.thumb;
					}
				} catch {
					// Avatar is optional
				}
			}

			return {
				status: 'valid',
				user: {
					username: data.username,
					email: data.email,
					avatarUrl: avatarUrl ?? undefined,
				},
			};
		} catch (error) {
			console.warn('Plex user check returned an unreadable response:', error);
			return { status: 'unreachable' };
		}
	}

	/**
	 * Select a different server
	 */
	async selectServer(serverId: string): Promise<boolean> {
		const server = this.authState.servers.find((s) => s.id === serverId);
		if (!server) {
			console.error('Server not found:', serverId);
			return false;
		}

		// Test connection to the new server (with authentication)
		const isConnected = await plexDiscoveryService.testServerConnection(server, this.authState.accessToken);
		if (!isConnected) {
			console.error('Failed to connect to selected server');
			return false;
		}

		// Update selected server
		this.authState.selectedServer = server;
		this.saveAuthState();
		this.notifyServerChange();

		// console.log(`✅ Selected server: ${server.name}`);
		return true;
	}

	/**
	 * Refresh server list
	 */
	async refreshServers(): Promise<boolean> {
		if (!this.authState.accessToken) {
			return false;
		}

		try {
			const discoveryResult = await plexDiscoveryService.discoverServers(this.authState.accessToken);
			if (discoveryResult.servers.length > 0) {
				this.authState.servers = discoveryResult.servers;

				// Update selected server to refreshed version (with connections), or pick a new one
				const previousServerId = this.authState.selectedServer?.id;
				if (this.authState.selectedServer) {
					const refreshed = discoveryResult.servers.find((s) => s.id === this.authState.selectedServer?.id);
					this.authState.selectedServer = refreshed || discoveryResult.recommendedServer;
				}

				this.saveAuthState();
				if (this.authState.selectedServer?.id !== previousServerId) {
					this.notifyServerChange();
				}
				return true;
			}
			return false;
		} catch (error) {
			console.error('Failed to refresh servers:', error);
			return false;
		}
	}

	/**
	 * Get current authentication state
	 */
	getAuthState(): PlexAuthState {
		return { ...this.authState };
	}

	/**
	 * Check if user is authenticated
	 */
	isAuthenticated(): boolean {
		return this.authState.isAuthenticated;
	}

	/**
	 * Get selected server
	 */
	getSelectedServer(): PlexServer | undefined {
		return this.authState.selectedServer;
	}

	/**
	 * Get access token
	 */
	getAccessToken(): string | undefined {
		return this.authState.accessToken;
	}

	/**
	 * Logout and clear authentication state
	 */
	async logout(options: { removeDownloads?: boolean } = {}): Promise<void> {
		// Wipe account-scoped data first so nothing from this account outlives the session.
		const { resetUserData } = require('@/utils/session-reset');
		await resetUserData(options);

		this.authState = {
			isAuthenticated: false,
			servers: [],
		};

		storage.remove(AUTH_STATE_KEY);
		storage.remove('plex_servers_cache');
		await deleteSecret(TOKEN_SECRET_KEY);

		this.notifyServerChange();

		// console.log('✅ Logged out successfully');
	}

	/**
	 * Synchronously load the persisted auth state into memory (no network).
	 * Returns true when a signed-in state with a token was found.
	 */
	loadStoredAuthState(): boolean {
		try {
			const stored = storage.getString(AUTH_STATE_KEY);
			if (!stored) return false;
			const parsed: PlexAuthState = JSON.parse(stored);

			let token = getSecret(TOKEN_SECRET_KEY) ?? undefined;
			if (parsed.accessToken) {
				// Legacy format kept the token in plaintext MMKV: move it to the Keychain and strip it.
				if (!token) token = parsed.accessToken;
				if (setSecret(TOKEN_SECRET_KEY, token)) {
					const { accessToken: _legacy, ...rest } = parsed;
					storage.set(AUTH_STATE_KEY, JSON.stringify(rest));
				}
			}

			this.authState = { ...parsed, accessToken: token };
			return !!this.authState.accessToken && this.authState.isAuthenticated;
		} catch (error) {
			console.error('Failed to read stored auth state:', error);
			return false;
		}
	}

	/**
	 * Verify the in-memory token against plex.tv. Only an explicit rejection (401/403) signs the user
	 * out; if plex.tv is unreachable (no network, outage) or offline mode is on, the stored state is kept
	 * so cached/downloaded music still works. Returns whether the user is still authenticated.
	 */
	async validateStoredAuth(): Promise<boolean> {
		if (!this.authState.accessToken) return false;

		// Offline mode: trust the stored state without contacting plex.tv
		if (getIsOfflineMode()) return this.authState.isAuthenticated;

		try {
			const userResult = await this.getUserInfo(this.authState.accessToken);
			if (userResult.status === 'invalid') {
				console.warn('Stored Plex token was rejected; signing out');
				await this.logout();
				return false;
			}
			if (userResult.status === 'unreachable') {
				return this.authState.isAuthenticated;
			}

			// Refresh username, email, avatar from API (e.g. avatar not in old stored state)
			const userInfo = userResult.user;
			this.authState.username = userInfo.username;
			this.authState.email = userInfo.email;
			if (userInfo.avatarUrl) this.authState.avatarUrl = userInfo.avatarUrl;
			this.saveAuthState();

			// If persisted server is missing connections (old format), refresh before proceeding
			if (this.authState.selectedServer && !this.authState.selectedServer.connections?.length) {
				console.log('🔄 Refreshing servers to populate connections...');
				try {
					await this.refreshServers();
				} catch (err) {
					console.warn('Server refresh failed:', err);
				}
			}

			return true;
		} catch (error) {
			console.error('Failed to validate auth state:', error);
			return this.authState.isAuthenticated;
		}
	}

	/**
	 * Load the persisted auth state and validate it against plex.tv.
	 */
	async loadAuthState(): Promise<boolean> {
		if (!this.loadStoredAuthState()) return false;
		return this.validateStoredAuth();
	}

	/**
	 * Save authentication state to storage
	 */
	private saveAuthState(): void {
		try {
			const { accessToken, ...rest } = this.authState;
			if (accessToken) setSecret(TOKEN_SECRET_KEY, accessToken);
			// The token never goes into MMKV; it is stored in the Keychain only.
			storage.set(AUTH_STATE_KEY, JSON.stringify(rest));
		} catch (error) {
			console.error('Failed to save auth state:', error);
		}
	}
}

// Export singleton instance
export const plexAuthService = PlexAuthService.getInstance();
