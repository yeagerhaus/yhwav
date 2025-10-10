import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch } from 'expo/fetch';
import { type PlexServer, plexDiscoveryService } from './plex-discovery';

export interface PlexAuthState {
	isAuthenticated: boolean;
	username?: string;
	email?: string;
	servers: PlexServer[];
	selectedServer?: PlexServer;
	accessToken?: string;
}

export interface PlexLoginResult {
	success: boolean;
	authState?: PlexAuthState;
	error?: string;
}

export class PlexAuthService {
	private static instance: PlexAuthService;
	private authState: PlexAuthState = {
		isAuthenticated: false,
		servers: [],
	};

	private constructor() {}

	static getInstance(): PlexAuthService {
		if (!PlexAuthService.instance) {
			PlexAuthService.instance = new PlexAuthService();
		}
		return PlexAuthService.instance;
	}

	/**
	 * Login with Plex token and discover servers
	 */
	async loginWithToken(plexToken: string): Promise<PlexLoginResult> {
		try {
			console.log('🔐 Logging in with Plex token...');

			// First, verify the token by getting user info
			const userInfo = await this.getUserInfo(plexToken);
			if (!userInfo) {
				return {
					success: false,
					error: 'Invalid Plex token. Please check your token and try again.',
				};
			}

			// Discover available servers
			const discoveryResult = await plexDiscoveryService.discoverServers(plexToken);
			if (!discoveryResult.servers.length) {
				return {
					success: false,
					error: discoveryResult.error || 'No Plex servers found. Please check your server is running and accessible.',
				};
			}

			// Test connection to recommended server
			const recommendedServer = discoveryResult.recommendedServer;
			if (recommendedServer) {
				const isConnected = await plexDiscoveryService.testServerConnection(recommendedServer);
				if (!isConnected) {
					console.warn('⚠️ Recommended server connection failed, trying other servers...');

					// Try other servers
					for (const server of discoveryResult.servers) {
						if (server.id !== recommendedServer.id) {
							const connected = await plexDiscoveryService.testServerConnection(server);
							if (connected) {
								recommendedServer.id = server.id;
								recommendedServer.uri = server.uri;
								recommendedServer.serverId = server.serverId;
								break;
							}
						}
					}
				}
			}

			// Update auth state
			this.authState = {
				isAuthenticated: true,
				username: userInfo.username,
				email: userInfo.email,
				servers: discoveryResult.servers,
				selectedServer: recommendedServer,
				accessToken: plexToken,
			};

			// Save to storage
			await this.saveAuthState();

			console.log('✅ Login successful!');
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
	 * Get user information from Plex API
	 */
	private async getUserInfo(plexToken: string): Promise<{ username: string; email: string } | null> {
		try {
			const response = await fetch('https://plex.tv/api/v2/user', {
				method: 'GET',
				headers: {
					'X-Plex-Token': plexToken,
					Accept: 'application/json',
				},
			});

			if (!response.ok) {
				return null;
			}

			const data = await response.json();
			return {
				username: data.username,
				email: data.email,
			};
		} catch (error) {
			console.error('Failed to get user info:', error);
			return null;
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

		// Test connection to the new server
		const isConnected = await plexDiscoveryService.testServerConnection(server);
		if (!isConnected) {
			console.error('Failed to connect to selected server');
			return false;
		}

		// Update selected server
		this.authState.selectedServer = server;
		await this.saveAuthState();

		console.log(`✅ Selected server: ${server.name}`);
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

				// If current selected server is no longer available, select a new one
				if (this.authState.selectedServer) {
					const stillAvailable = discoveryResult.servers.find((s) => s.id === this.authState.selectedServer?.id);
					if (!stillAvailable) {
						this.authState.selectedServer = discoveryResult.recommendedServer;
					}
				}

				await this.saveAuthState();
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
	async logout(): Promise<void> {
		this.authState = {
			isAuthenticated: false,
			servers: [],
		};

		// Clear storage
		await AsyncStorage.multiRemove(['plex_auth_state', 'plex_servers_cache']);

		// Clear discovery cache
		await plexDiscoveryService.clearCache();

		console.log('✅ Logged out successfully');
	}

	/**
	 * Load authentication state from storage
	 */
	async loadAuthState(): Promise<boolean> {
		try {
			const stored = await AsyncStorage.getItem('plex_auth_state');
			if (stored) {
				const data = JSON.parse(stored);
				this.authState = data;

				// Verify the stored state is still valid
				if (this.authState.accessToken) {
					const userInfo = await this.getUserInfo(this.authState.accessToken);
					if (userInfo) {
						console.log('✅ Loaded authentication state from storage');
						return true;
					} else {
						// Token is invalid, clear state
						await this.logout();
					}
				}
			}
		} catch (error) {
			console.error('Failed to load auth state:', error);
		}
		return false;
	}

	/**
	 * Save authentication state to storage
	 */
	private async saveAuthState(): Promise<void> {
		try {
			await AsyncStorage.setItem('plex_auth_state', JSON.stringify(this.authState));
		} catch (error) {
			console.error('Failed to save auth state:', error);
		}
	}

	/**
	 * Update server configuration when a new server is selected
	 */
	async updateServerConfiguration(): Promise<void> {
		if (this.authState.selectedServer) {
			await plexDiscoveryService.updateServerConfiguration(this.authState.selectedServer);
		}
	}
}

// Export singleton instance
export const plexAuthService = PlexAuthService.getInstance();
