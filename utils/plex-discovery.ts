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

			// Use the traditional /api/resources endpoint (v2 doesn't have this endpoint)
			// Token can be passed as header or query parameter - try both approaches
			const url = `https://plex.tv/api/resources?includeHttps=1&X-Plex-Token=${encodeURIComponent(plexToken)}`;
			const response = await fetch(url, {
				headers: {
					'X-Plex-Token': plexToken,
					Accept: 'application/json, application/xml',
				},
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Unknown error');
				console.error(`❌ Server discovery failed: ${response.status} - ${errorText}`);
				return {
					servers: [],
					error: `Failed to discover servers: ${response.status} ${response.statusText}`,
				};
			}

			const responseText = await response.text();
			let servers: PlexServer[] = [];

			// Try to parse as JSON first
			try {
				const data = JSON.parse(responseText);
				
				// Handle array response
				const resources = Array.isArray(data) ? data : (data.MediaContainer?.Device || []);
				
				for (const resource of resources) {
					// Check if this resource provides server functionality
					const provides = resource.provides || resource.capabilities || [];
					const providesArray = Array.isArray(provides) ? provides : provides.split(',');
					
					if (providesArray.includes('server') || resource.server) {
						// Extract connection info
						const connections = resource.Connection || resource.connections || [];
						const connection = Array.isArray(connections) ? connections[0] : connections;
						
						const address = connection?.address || resource.address || '';
						const port = parseInt(connection?.port || resource.port || '32400', 10);
						const local = connection?.local === true || connection?.local === '1' || resource.local === true || resource.local === '1';
						
						// Build URI - prefer existing URI, then construct from address/port
						let uri = connection?.uri || resource.uri;
						if (!uri) {
							if (!address) {
								console.warn(`⚠️ Skipping server ${resource.name} - no address found`);
								continue;
							}
							// Prefer HTTPS for remote connections, HTTP for local
							const protocol = local ? 'http' : 'https';
							uri = `${protocol}://${address}:${port}`;
						}
						
						// Validate URI format
						if (!uri.match(/^https?:\/\/.+/)) {
							console.warn(`⚠️ Invalid URI format for server ${resource.name}: ${uri}`);
							continue;
						}
						
						const server: PlexServer = {
							id: resource.clientIdentifier || resource.machineIdentifier,
							name: resource.name,
							uri,
							serverId: resource.clientIdentifier || resource.machineIdentifier,
							local,
							address: address || new URL(uri).hostname,
							port,
						};
						servers.push(server);
					}
				}
			} catch (jsonError) {
				// If JSON parsing fails, try XML parsing
				console.log('⚠️ Response is not JSON, trying XML parsing...');
				
				// Parse XML response
				const serverMatches = responseText.matchAll(/<Device[^>]*>(.*?)<\/Device>/gs);
				
				for (const match of serverMatches) {
					const deviceXml = match[0];
					const providesMatch = deviceXml.match(/provides="([^"]+)"/);
					const provides = providesMatch ? providesMatch[1].split(',') : [];
					
					if (provides.includes('server')) {
						const nameMatch = deviceXml.match(/name="([^"]+)"/);
						const idMatch = deviceXml.match(/clientIdentifier="([^"]+)"/);
						const connectionMatch = deviceXml.match(/<Connection[^>]*>(.*?)<\/Connection>/s);
						
						if (nameMatch && idMatch) {
							let uri = '';
							let address = '';
							let port = 32400;
							let local = false;
							
							if (connectionMatch) {
								const connXml = connectionMatch[0];
								const uriMatch = connXml.match(/uri="([^"]+)"/);
								const addrMatch = connXml.match(/address="([^"]+)"/);
								const portMatch = connXml.match(/port="([^"]+)"/);
								const localMatch = connXml.match(/local="([^"]+)"/);
								
								uri = uriMatch ? uriMatch[1] : '';
								address = addrMatch ? addrMatch[1] : '';
								port = portMatch ? parseInt(portMatch[1], 10) : 32400;
								local = localMatch ? localMatch[1] === '1' : false;
							}
							
							// Build URI if not provided
							if (!uri) {
								if (address) {
									// Prefer HTTPS for remote connections, HTTP for local
									const protocol = local ? 'http' : 'https';
									uri = `${protocol}://${address}:${port}`;
								} else {
									// If no address, skip this server (invalid)
									console.warn(`⚠️ Skipping server ${nameMatch[1]} - no address found`);
									continue;
								}
							}
							
							// Validate URI format
							if (!uri.match(/^https?:\/\/.+/)) {
								console.warn(`⚠️ Invalid URI format for server ${nameMatch[1]}: ${uri}`);
								continue;
							}
							
							const server: PlexServer = {
								id: idMatch[1],
								name: nameMatch[1],
								uri,
								serverId: idMatch[1],
								local,
								address: address || new URL(uri).hostname,
								port,
							};
							servers.push(server);
						}
					}
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
	async testServerConnection(server: PlexServer, plexToken?: string): Promise<boolean> {
		try {
			console.log(`🔗 Testing connection to ${server.name}...`);

			// Build test URL with authentication
			const testUrl = new URL(`${server.uri}/status/sessions`);
			if (plexToken) {
				testUrl.searchParams.set('X-Plex-Token', plexToken);
			}

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000);

			const response = await fetch(testUrl.toString(), {
				headers: {
					Accept: 'application/json',
					...(plexToken && { 'X-Plex-Token': plexToken }),
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
