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

			// Request JSON response explicitly (Plex API supports JSON with Accept header)
			const url = `https://plex.tv/api/resources?includeHttps=1&X-Plex-Token=${encodeURIComponent(plexToken)}`;
			const response = await fetch(url, {
				headers: {
					'X-Plex-Token': plexToken,
					Accept: 'application/json',
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

			// Check content type
			const contentType = response.headers.get('content-type') || '';
			console.log(`   Response Content-Type: ${contentType}`);

			// Get response as text first to check format
			const responseText = await response.text();
			
			// The /api/resources endpoint doesn't support JSON, it only returns XML
			// So we need to parse XML for this specific endpoint
			if (contentType.includes('xml') || responseText.trim().startsWith('<')) {
				console.log('   ⚠️ /api/resources returned XML (this endpoint doesn\'t support JSON)');
				return this.parseResourcesXML(responseText);
			}

			// Parse JSON response (for other endpoints that support it)
			const data = JSON.parse(responseText);
			console.log(`   ✅ Successfully parsed JSON response`);
			
			// Handle array response (Plex returns array of resources)
			const resources = Array.isArray(data) ? data : (data.MediaContainer?.Device || []);
			console.log(`   Found ${resources.length} resources`);

			const servers: PlexServer[] = [];

			for (const resource of resources) {
				// Check if this resource provides server functionality
				const provides = resource.provides || resource.capabilities || [];
				const providesArray = Array.isArray(provides) ? provides : provides.split(',');

				if (providesArray.includes('server') || resource.server) {
					console.log(`   📡 Processing server: ${resource.name}`);

					// Extract connection info - Plex returns array of connections
					const connections = resource.Connection || resource.connections || [];
					const connectionsArray = Array.isArray(connections) ? connections : [connections];

					console.log(`      Found ${connectionsArray.length} connection(s)`);

					// Find best connection (prefer local, then first available with address)
					let bestConnection: {
						uri?: string;
						address?: string;
						port?: number;
						local?: boolean;
					} | null = null;

					for (const conn of connectionsArray) {
						if (!conn) continue;

						const connData = {
							uri: conn.uri,
							address: conn.address,
							port: parseInt(conn.port || '32400', 10),
							local: conn.local === true || conn.local === '1' || conn.local === 1,
						};

						console.log(
							`      Connection: uri=${connData.uri || 'none'}, address=${connData.address || 'none'}, port=${connData.port}, local=${connData.local}`,
						);

						// Prefer local connections with address, or first valid connection with address
						if (connData.address) {
							if (!bestConnection || (connData.local && !bestConnection.local)) {
								bestConnection = connData;
							}
						}
					}

					if (!bestConnection || !bestConnection.address) {
						console.warn(`   ⚠️ Skipping server ${resource.name} - no valid connection with address found`);
						continue;
					}

					// Build URI - prefer existing URI, then construct from address/port
					let uri = bestConnection.uri || resource.uri;
					if (!uri) {
						// Prefer HTTPS for remote connections, HTTP for local
						const protocol = bestConnection.local ? 'http' : 'https';
						uri = `${protocol}://${bestConnection.address}:${bestConnection.port}`;
						console.log(`      ✅ Constructed URI: ${uri}`);
					}

					// Validate URI format
					if (!uri.match(/^https?:\/\/.+/)) {
						console.warn(`   ⚠️ Invalid URI format for server ${resource.name}: ${uri}`);
						continue;
					}

					const server: PlexServer = {
						id: resource.clientIdentifier || resource.machineIdentifier,
						name: resource.name,
						uri,
						serverId: resource.clientIdentifier || resource.machineIdentifier,
						local: bestConnection.local || false,
						address: bestConnection.address,
						port: bestConnection.port,
					};

					console.log(`   ✅ Added server: ${server.name} - ${server.uri}`);
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
	 * Parse XML response from /api/resources endpoint
	 * This endpoint doesn't support JSON, so we must parse XML
	 */
	private parseResourcesXML(xmlText: string): PlexDiscoveryResult {
		try {
			console.log('   📄 Parsing XML response...');
			const servers: PlexServer[] = [];

			// Parse XML response - find all Device elements
			const deviceMatches = Array.from(xmlText.matchAll(/<Device[^>]*>([\s\S]*?)<\/Device>/g));
			console.log(`   Found ${deviceMatches.length} Device elements`);

			for (const match of deviceMatches) {
				const deviceXml = match[0];
				const providesMatch = deviceXml.match(/provides="([^"]+)"/);
				const provides = providesMatch ? providesMatch[1].split(',') : [];

				if (provides.includes('server')) {
					const nameMatch = deviceXml.match(/name="([^"]+)"/);
					const idMatch = deviceXml.match(/clientIdentifier="([^"]+)"/);

					if (!nameMatch || !idMatch) {
						console.warn('   ⚠️ Skipping server - missing name or ID');
						continue;
					}

					console.log(`   📡 Found server: ${nameMatch[1]} (${idMatch[1]})`);

					// Find ALL Connection elements (Plex returns multiple - local, remote, etc.)
					const connectionMatches = Array.from(deviceXml.matchAll(/<Connection[^>]*\/>/g));
					console.log(`      Found ${connectionMatches.length} Connection elements`);

					let bestConnection: { uri?: string; address?: string; port?: number; local?: boolean } | null = null;

					// Parse all connections and prefer local ones with addresses
					for (const connMatch of connectionMatches) {
						const connXml = connMatch[0];
						const uriMatch = connXml.match(/uri="([^"]+)"/);
						const addrMatch = connXml.match(/address="([^"]+)"/);
						const portMatch = connXml.match(/port="([^"]+)"/);
						const localMatch = connXml.match(/local="([^"]+)"/);

						const conn = {
							uri: uriMatch ? uriMatch[1] : undefined,
							address: addrMatch ? addrMatch[1] : undefined,
							port: portMatch ? parseInt(portMatch[1], 10) : 32400,
							local: localMatch ? localMatch[1] === '1' : false,
						};

						console.log(
							`      Connection: uri=${conn.uri || 'none'}, address=${conn.address || 'none'}, port=${conn.port}, local=${conn.local}`,
						);

						// Prefer local connections with address, or first valid connection with address
						if (conn.address) {
							if (!bestConnection || (conn.local && !bestConnection.local)) {
								bestConnection = conn;
							}
						}
					}

					if (!bestConnection || !bestConnection.address) {
						console.warn(`   ⚠️ Skipping server ${nameMatch[1]} - no valid connection with address found`);
						continue;
					}

					// Build URI if not provided
					let uri = bestConnection.uri || '';
					if (!uri) {
						// Prefer HTTPS for remote connections, HTTP for local
						const protocol = bestConnection.local ? 'http' : 'https';
						uri = `${protocol}://${bestConnection.address}:${bestConnection.port}`;
						console.log(`      ✅ Constructed URI: ${uri}`);
					}

					// Validate URI format
					if (!uri.match(/^https?:\/\/.+/)) {
						console.warn(`   ⚠️ Invalid URI format for server ${nameMatch[1]}: ${uri}`);
						continue;
					}

					const server: PlexServer = {
						id: idMatch[1],
						name: nameMatch[1],
						uri,
						serverId: idMatch[1],
						local: bestConnection.local || false,
						address: bestConnection.address,
						port: bestConnection.port,
					};

					console.log(`   ✅ Added server: ${server.name} - ${server.uri}`);
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
			console.error('❌ XML parsing failed:', error);
			return {
				servers: [],
				error: error instanceof Error ? error.message : 'Unknown error during XML parsing',
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
