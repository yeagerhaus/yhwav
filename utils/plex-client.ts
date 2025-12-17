import { fetch } from 'expo/fetch';
import type { Playlist } from '@/types/playlist';
import type { Song } from '@/types/song';
import { plexAuthService } from './plex-auth';

// Retry configuration
const RETRY_CONFIG = {
	maxRetries: 3,
	baseDelay: 1000, // 1 second
	maxDelay: 10000, // 10 seconds
	backoffMultiplier: 2,
};

// Timeout configuration
const TIMEOUT_CONFIG = {
	connectTimeout: 15000, // 15 seconds
	requestTimeout: 30000, // 30 seconds
};

export interface PlexError extends Error {
	code?: string;
	status?: number;
	retryable?: boolean;
}

export interface PlexResponse<T = any> {
	data: T;
	status: number;
	headers: Record<string, string>;
}

/**
 * Creates a robust Plex client with SSL handling, retry logic, and JSON support
 */
export class PlexClient {
	private baseURL: string = '';
	private token: string | null = null;
	private musicSectionId: string | null = null;

	constructor(baseURL?: string) {
		if (baseURL) {
			this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
		}
	}

	/**
	 * Initialize the client with authentication
	 */
	async initialize(): Promise<void> {
		console.log('🔧 PlexClient.initialize() called');
		
		if (!plexAuthService.isAuthenticated()) {
			console.error('❌ Not authenticated');
			throw new Error(
				'No Plex authentication available. Please sign in through Settings.',
			);
		}

		const selectedServer = plexAuthService.getSelectedServer();
		if (!selectedServer) {
			console.error('❌ No server selected');
			throw new Error('No Plex server selected. Please select a server in Settings.');
		}

		console.log(`📡 Selected server: ${selectedServer.name}`);
		console.log(`   ID: ${selectedServer.id}`);
		console.log(`   URI: ${selectedServer.uri}`);
		console.log(`   Address: ${selectedServer.address}`);
		console.log(`   Port: ${selectedServer.port}`);
		console.log(`   Local: ${selectedServer.local}`);

		if (!selectedServer.uri) {
			console.error('❌ Server has no URI');
			throw new Error(`Server "${selectedServer.name}" has no valid URI. Please refresh servers in Settings.`);
		}

		// Validate and clean the server URI
		let serverUri = selectedServer.uri.trim();
		console.log(`🧹 Cleaning URI: "${serverUri}"`);
		
		// Remove any existing API paths and ensure we have just the base server URL
		serverUri = serverUri
			.replace(/\/playlists.*$/, '')
			.replace(/\/library.*$/, '')
			.replace(/\/status.*$/, '')
			.replace(/\/$/, '');
		
		console.log(`   After cleaning: "${serverUri}"`);
		
		// Validate URI format - must have protocol and hostname
		if (!serverUri.match(/^https?:\/\/.+/)) {
			console.warn('⚠️ URI missing protocol/hostname, attempting reconstruction...');
			// If URI is missing hostname, try to construct it from address and port
			if (selectedServer.address && selectedServer.port) {
				const protocol = selectedServer.local ? 'http' : 'https';
				serverUri = `${protocol}://${selectedServer.address}:${selectedServer.port}`;
				console.log(`   ✅ Reconstructed server URI: ${serverUri}`);
			} else {
				console.error(`   ❌ Cannot reconstruct - address: ${selectedServer.address}, port: ${selectedServer.port}`);
				throw new Error(
					`Invalid server URI format: "${selectedServer.uri}". Server: ${selectedServer.name}. Please refresh servers in Settings.`,
				);
			}
		}
		
		this.baseURL = serverUri;
		this.token = plexAuthService.getAccessToken() || '';
		console.log('✅ PlexClient initialized:');
		console.log(`   Server: ${selectedServer.name}`);
		console.log(`   Base URL: ${this.baseURL}`);
		console.log(`   Token: ${this.token ? '***' + this.token.slice(-4) : 'MISSING'}`);

		// Music section ID will be auto-discovered when needed
		this.musicSectionId = null;
	}

	/**
	 * Auto-discover music section ID from library
	 */
	private async discoverMusicSection(): Promise<void> {
		console.log('🔍 discoverMusicSection() called');
		try {
			const sections = await this.getLibrarySections();
			console.log(`   Found ${sections.length} library sections`);
			sections.forEach((section: any, index: number) => {
				console.log(`   Section ${index + 1}: ${section.title} (type: ${section.type}, key: ${section.key})`);
			});
			
			const musicSection = sections.find((section: any) => section.type === 'artist' || section.type === 'music');
			if (musicSection) {
				this.musicSectionId = musicSection.key;
				console.log(`✅ Auto-discovered music section: ${musicSection.title} (ID: ${this.musicSectionId})`);
			} else {
				console.warn('⚠️ No music section found in library');
				console.warn('   Available section types:', sections.map((s: any) => s.type).join(', '));
			}
		} catch (error) {
			console.error('❌ Failed to discover music section:', error);
			throw error;
		}
	}

	/**
	 * Build a Plex URL with authentication and parameters
	 */
	private buildURL(path: string, params: Record<string, string> = {}): string {
		// Validate baseURL before using it
		if (!this.baseURL || !this.baseURL.match(/^https?:\/\/.+/)) {
			console.error('❌ buildURL: Invalid baseURL:', this.baseURL);
			throw new Error(
				`Invalid baseURL: "${this.baseURL}". Please ensure you are authenticated and have selected a valid server.`,
			);
		}

		// Ensure path starts with /
		const normalizedPath = path.startsWith('/') ? path : `/${path}`;

		console.log(`🔗 buildURL: baseURL="${this.baseURL}", path="${normalizedPath}"`);

		const url = new URL(`${this.baseURL}${normalizedPath}`);

		// Add authentication token
		if (this.token) {
			url.searchParams.set('X-Plex-Token', this.token);
			console.log('   ✅ Added X-Plex-Token to URL');
		} else {
			console.warn('   ⚠️ No token available for URL');
		}

		// Add additional parameters
		if (Object.keys(params).length > 0) {
			console.log('   📋 Adding params:', params);
			for (const [key, value] of Object.entries(params)) {
				url.searchParams.set(key, value);
			}
		}

		const finalUrl = url.toString();
		console.log(`   ✅ Final URL: ${finalUrl.replace(/X-Plex-Token=[^&]+/, 'X-Plex-Token=***')}`);
		return finalUrl;
	}

	/**
	 * Create an AbortController with timeout
	 */
	private createTimeoutController(timeout: number): AbortController {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), timeout);
		return controller;
	}

	/**
	 * Sleep utility for retry delays
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Calculate retry delay with exponential backoff
	 */
	private calculateRetryDelay(attempt: number): number {
		const delay = Math.min(RETRY_CONFIG.baseDelay * RETRY_CONFIG.backoffMultiplier ** attempt, RETRY_CONFIG.maxDelay);
		// Add jitter to prevent thundering herd
		return delay + Math.random() * 1000;
	}

	/**
	 * Check if an error is retryable
	 */
	private isRetryableError(error: any): boolean {
		// Network errors, timeouts, and 5xx server errors are retryable
		if (error.name === 'AbortError' || error.message?.includes('timeout')) {
			return true;
		}
		if (error.message?.includes('Network request failed')) {
			return true;
		}
		if (error.status >= 500) {
			return true;
		}
		// SSL certificate errors are retryable
		if (error.message?.includes('certificate') || error.message?.includes('SSL') || error.message?.includes('TLS')) {
			return true;
		}
		return false;
	}

	/**
	 * Try HTTP fallback if HTTPS fails with SSL error
	 */
	private getFallbackUrl(originalUrl: string): string | null {
		if (originalUrl.startsWith('https://') && originalUrl.includes('.plex.direct')) {
			return originalUrl.replace('https://', 'http://');
		}
		return null;
	}

	/**
	 * Make a robust HTTP request with retry logic and SSL handling
	 */
	async request<T = any>(
		path: string,
		params: Record<string, string> = {},
		options: {
			method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
			headers?: Record<string, string>;
			timeout?: number;
			retries?: number;
		} = {},
	): Promise<PlexResponse<T>> {
		const { method = 'GET', headers = {}, timeout = TIMEOUT_CONFIG.requestTimeout, retries = RETRY_CONFIG.maxRetries } = options;

		console.log(`📤 PlexClient.request(): ${method} ${path}`);
		console.log(`   Params:`, params);
		console.log(`   BaseURL: ${this.baseURL}`);
		console.log(`   Token: ${this.token ? 'present' : 'missing'}`);

		const url = this.buildURL(path, params);

		// Default headers for Plex API
		const defaultHeaders = {
			Accept: 'application/json',
			'User-Agent': 'YHPlayer/1.0.0',
			'X-Plex-Client-Identifier': 'yhplayer-mobile',
			...headers,
		};

		let lastError: any;
		let triedHttpFallback = false;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const controller = this.createTimeoutController(timeout);

				// For React Native, we need to handle SSL certificate issues differently
				// The issue is that Plex's dynamic DNS certificates don't match the hostname
				// Since CURL works with -k flag, we'll try the original URL first
				// and handle SSL errors gracefully with retry logic
				let requestUrl = url;
				const additionalHeaders = {};

				// Try HTTP fallback if this is a retry after SSL error
				if (attempt > 0 && lastError?.message?.includes('TLS') && !triedHttpFallback) {
					const fallbackUrl = this.getFallbackUrl(url);
					if (fallbackUrl) {
						requestUrl = fallbackUrl;
						triedHttpFallback = true;
						console.log('🔄 Trying HTTP fallback:', requestUrl);
					}
				} else {
					console.log(`🔄 Using original Plex URL (attempt ${attempt + 1}/${retries + 1}):`, requestUrl.replace(/X-Plex-Token=[^&]+/, 'X-Plex-Token=***'));
				}

				// Add SSL handling for React Native
				const fetchOptions: any = {
					method,
					headers: { ...defaultHeaders, ...additionalHeaders },
					signal: controller.signal,
				};

				console.log(`   📡 Making ${method} request...`);
				const response = await fetch(requestUrl, fetchOptions);
				console.log(`   📥 Response status: ${response.status} ${response.statusText}`);

				// Handle HTTP errors
				if (!response.ok) {
					const errorText = await response.text().catch(() => 'Unknown error');
					console.error(`   ❌ Request failed: ${response.status} - ${errorText.substring(0, 200)}`);
					const error: PlexError = new Error(`HTTP ${response.status}: ${errorText}`);
					error.status = response.status;
					error.code = `HTTP_${response.status}`;
					error.retryable = response.status >= 500;

					// Don't retry on 4xx errors (except 408, 429)
					if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
						throw error;
					}

					lastError = error;
					if (attempt < retries && error.retryable) {
						await this.sleep(this.calculateRetryDelay(attempt));
						continue;
					}
					throw error;
				}

				// Parse response
				const contentType = response.headers.get('content-type') || '';
				console.log(`   📄 Content-Type: ${contentType}`);
				let data: T;

				if (contentType.includes('application/json')) {
					data = await response.json();
					console.log(`   ✅ Parsed JSON response (data keys: ${Object.keys(data as any).join(', ')})`);
				} else {
					// Fallback to text for non-JSON responses
					const textData = await response.text();
					console.log(`   ⚠️ Non-JSON response (length: ${textData.length} chars)`);
					data = textData as T;
				}

				// Extract response headers
				const responseHeaders: Record<string, string> = {};
				response.headers.forEach((value, key) => {
					responseHeaders[key] = value;
				});

				console.log(`   ✅ Request successful: ${response.status}`);
				return {
					data,
					status: response.status,
					headers: responseHeaders,
				};
			} catch (error: any) {
				lastError = error;

				// Check if this is the last attempt
				if (attempt >= retries) {
					break;
				}

				// Check if error is retryable
				if (!this.isRetryableError(error)) {
					break;
				}

				// For SSL/TLS errors, provide helpful guidance
				if (error.message?.includes('TLS') || error.message?.includes('certificate') || error.message?.includes('SSL')) {
					console.log('🔧 SSL Certificate Issue Detected!');
					console.log('💡 Try these Plex server settings:');
					console.log('   1. Set "Custom certificate domain" to your hostname');
					console.log('   2. Uncheck "Strict TLS configuration"');
					console.log('   3. Or use "Custom certificate location" with a matching cert');
				}

				// Wait before retrying
				await this.sleep(this.calculateRetryDelay(attempt));
			}
		}

		// If we get here, all retries failed
		throw lastError || new Error('Request failed after all retries');
	}

	/**
	 * Test Plex server connectivity
	 */
	async testConnectivity(): Promise<boolean> {
		try {
			await this.initialize();

			// Try a simple status endpoint first
			const response = await this.request(
				'/status/sessions',
				{},
				{
					timeout: TIMEOUT_CONFIG.connectTimeout,
					retries: 1, // Only retry once for connectivity test
				},
			);

			return response.status === 200;
		} catch (error) {
			console.error('Plex connectivity test failed:', error);
			return false;
		}
	}

	/**
	 * Fetch all tracks from the music library
	 */
	async fetchAllTracks(): Promise<Song[]> {
		console.log('🎵 fetchAllTracks() called');
		await this.initialize();

		// Auto-discover music section if not set
		if (!this.musicSectionId) {
			console.log('🔍 Music section not set, discovering...');
			await this.discoverMusicSection();
		}

		if (!this.musicSectionId) {
			console.error('❌ No music section ID found');
			throw new Error('Music section ID not found. Please ensure your library has a music section.');
		}

		const libraryUrl = `/library/sections/${this.musicSectionId}/all`;
		console.log(`📚 Fetching tracks from: ${libraryUrl}`);
		console.log(`   Section ID: ${this.musicSectionId}`);
		console.log(`   Base URL: ${this.baseURL}`);
		
		const response = await this.request(libraryUrl, {
			type: '10', // 10 = track
			sort: 'titleSort:asc',
		});

		const data = response.data as any;
		const rawTracks = data?.MediaContainer?.Metadata || [];

		// Process tracks in parallel for better performance
		const tracks = await Promise.all((Array.isArray(rawTracks) ? rawTracks : [rawTracks]).map((track) => this.formatTrack(track)));

		return tracks;
	}

	/**
	 * Format a Plex track into our Song type
	 */
	private async formatTrack(track: any, playlistIndex?: number): Promise<Song> {
		const media = track.Media?.[0];
		const part = media?.Part?.[0];
		const duration = parseInt(track.duration || part?.duration || '0', 10);

		// Build stream URL
		const streamUrl = part?.key ? this.buildURL(part.key) : '';

		// Build artwork URL
		const artworkUrl = track.thumb ? this.buildURL(track.thumb) : undefined;

		return {
			id: track.ratingKey,
			title: track.title,
			artist: track.grandparentTitle,
			album: track.parentTitle,
			artworkUrl,
			artwork: '', // Will be populated by image loading
			streamUrl,
			uri: streamUrl,
			duration,
			trackNumber: parseInt(track.index || '0', 10),
			discNumber: parseInt(track.parentIndex || '0', 10),
			playlistIndex,
			artistKey: track.grandparentKey || '',
		};
	}

	/**
	 * Get library sections
	 */
	async getLibrarySections(): Promise<any[]> {
		console.log('📚 getLibrarySections() called');
		await this.initialize();

		console.log(`📚 Fetching library sections from: /library/sections`);
		console.log(`   Base URL: ${this.baseURL}`);
		
		const response = await this.request('/library/sections');
		const data = response.data as any;
		return data?.MediaContainer?.Directory || [];
	}

	/**
	 * Search the library
	 */
	async search(query: string, type?: string): Promise<any[]> {
		await this.initialize();

		const params: Record<string, string> = { query };
		if (type) {
			params.type = type;
		}

		const response = await this.request('/search', params);
		const data = response.data as any;
		return data?.MediaContainer?.Metadata || [];
	}

	/**
	 * Fetch all playlists
	 */
	async fetchAllPlaylists(): Promise<Playlist[]> {
		console.log('📋 fetchAllPlaylists() called');
		await this.initialize();

		console.log(`📚 Fetching playlists from: /playlists`);
		console.log(`   Base URL: ${this.baseURL}`);
		
		const response = await this.request('/playlists');
		const data = response.data as any;
		const rawPlaylists = data?.MediaContainer?.Metadata || [];

		// Process playlists in parallel for better performance
		const playlists = await Promise.all(
			(Array.isArray(rawPlaylists) ? rawPlaylists : [rawPlaylists]).map((playlist) => this.formatPlaylist(playlist)),
		);

		return playlists;
	}

	/**
	 * Fetch a specific playlist by ID
	 */
	async fetchPlaylist(playlistId: string): Promise<Playlist | null> {
		await this.initialize();

		try {
			const response = await this.request(`/playlists/${playlistId}`);
			const data = response.data as any;
			const playlist = data?.MediaContainer?.Metadata?.[0];

			if (!playlist) {
				return null;
			}

			return this.formatPlaylist(playlist);
		} catch (error) {
			console.error('Failed to fetch playlist:', error);
			return null;
		}
	}

	/**
	 * Fetch tracks from a specific playlist
	 */
	async fetchPlaylistTracks(playlistId: string): Promise<Song[]> {
		await this.initialize();

		try {
			const response = await this.request(`${playlistId}`);
			const data = response.data as any;
			const rawTracks = data?.MediaContainer?.Metadata || [];

			// Process tracks in parallel for better performance, preserving order
			const tracks = await Promise.all(
				(Array.isArray(rawTracks) ? rawTracks : [rawTracks]).map((track, index) => this.formatTrack(track, index)),
			);

			return tracks;
		} catch (error) {
			console.error('Failed to fetch playlist tracks:', error);
			return [];
		}
	}

	/**
	 * Format a Plex playlist into our Playlist type
	 */
	private async formatPlaylist(playlist: any): Promise<Playlist> {
		// Build artwork URL
		const artworkUrl = playlist.thumb ? this.buildURL(playlist.thumb) : undefined;

		return {
			id: playlist.ratingKey,
			title: playlist.title,
			summary: playlist.summary,
			playlistType: playlist.playlistType as 'audio' | 'video' | 'photo',
			artworkUrl,
			artwork: '', // Will be populated by image loading
			duration: parseInt(playlist.duration || '0', 10),
			leafCount: parseInt(playlist.leafCount || '0', 10),
			createdAt: playlist.addedAt,
			updatedAt: playlist.updatedAt,
			smart: playlist.smart === '1',
			composite: playlist.composite,
			ratingKey: playlist.ratingKey,
			key: playlist.key,
			guid: playlist.guid,
		};
	}
}

// Create singleton instance (baseURL will be set during initialization)
export const plexClient = new PlexClient();

// Export convenience functions for backward compatibility
export const testPlexServer = () => plexClient.testConnectivity();
export const fetchAllTracks = () => plexClient.fetchAllTracks();
export const fetchAllPlaylists = () => plexClient.fetchAllPlaylists();
export const fetchPlaylist = (playlistId: string) => plexClient.fetchPlaylist(playlistId);
export const fetchPlaylistTracks = (playlistId: string) => plexClient.fetchPlaylistTracks(playlistId);
export const buildPlexURL = async (path: string, params: Record<string, string> = {}) => {
	await plexClient.initialize();
	return (plexClient as any).buildURL(path, params);
};
