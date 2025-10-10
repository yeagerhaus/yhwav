import { fetch } from 'expo/fetch';

export interface PlexServer {
	id: string;
	name: string;
	uri: string;
	serverId: string;
	local: boolean;
	address: string;
	port: number;
}

export interface PlexDiscoveryResult {
	servers: PlexServer[];
	recommendedServer?: PlexServer;
	error?: string;
}

class PlexDiscoveryService {
	/**
	 * Discover available Plex servers using the Plex.tv API
	 */
	async discoverServers(plexToken: string): Promise<PlexDiscoveryResult> {
		try {
			console.log('🔍 Discovering Plex servers...');

			const response = await fetch('https://plex.tv/api/v2/resources', {
				headers: {
					'X-Plex-Token': plexToken,
					Accept: 'application/json',
				},
			});

			if (!response.ok) {
				return {
					servers: [],
					error: `Failed to discover servers: ${response.status} ${response.statusText}`,
				};
			}

			const data = await response.json();
			const servers: PlexServer[] = [];

			for (const resource of data) {
				if (resource.provides?.includes('server')) {
					const server: PlexServer = {
						id: resource.clientIdentifier,
						name: resource.name,
						uri: resource.uri,
						serverId: resource.clientIdentifier,
						local: resource.local === '1',
						address: resource.connections?.[0]?.address ?? '',
						port: parseInt(resource.connections?.[0]?.port ?? '32400'),
					};
					servers.push(server);
				}
			}

			// Find recommended server (prefer local, then first available)
			const recommendedServer = servers.find((s) => s.local) || servers[0];

			console.log(`✅ Found ${servers.length} servers`);
			return {
				servers,
				recommendedServer,
			};
		} catch (error) {
			console.error('❌ Server discovery failed:', error);
			return {
				servers: [],
				error: error instanceof Error ? error.message : 'Unknown error during server discovery',
			};
		}
	}

	/**
	 * Test connection to a specific Plex server
	 */
	async testServerConnection(server: PlexServer): Promise<boolean> {
		try {
			console.log(`🔗 Testing connection to ${server.name}...`);

			const testUrl = `${server.uri}/status/sessions`;
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000);

			const response = await fetch(testUrl, {
				headers: {
					Accept: 'application/json',
				},
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			const isConnected = response.ok;
			console.log(`${isConnected ? '✅' : '❌'} Server ${server.name}: ${isConnected ? 'Connected' : 'Failed'}`);
			return isConnected;
		} catch (error) {
			console.error(`❌ Connection test failed for ${server.name}:`, error);
			return false;
		}
	}

	/**
	 * Clear any cached discovery data
	 */
	async clearCache(): Promise<void> {
		// No caching implemented yet, but keeping for future use
		console.log('🗑️ Cleared discovery cache');
	}

	/**
	 * Update server configuration (placeholder for future use)
	 */
	async updateServerConfiguration(server: PlexServer): Promise<void> {
		// No configuration updates needed yet
		console.log(`⚙️ Updated configuration for ${server.name}`);
	}
}

export const plexDiscoveryService = new PlexDiscoveryService();
