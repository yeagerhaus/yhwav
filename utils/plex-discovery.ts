import { fetch } from 'expo/fetch';

export interface PlexConnection {
	uri: string;
	address: string;
	port: number;
	local: boolean;
}

export interface PlexServer {
	id: string;
	name: string;
	uri: string;
	serverId: string;
	local: boolean;
	address: string;
	port: number;
	connections: PlexConnection[];
}

export interface PlexDiscoveryResult {
	servers: PlexServer[];
	recommendedServer?: PlexServer;
	error?: string;
}

/**
 * True for LAN / loopback / link-local addresses and mDNS hostnames. Plain-HTTP fallbacks are only
 * allowed for these: anything else would send the Plex token in cleartext over the internet.
 */
export function isPrivateAddress(address: string | undefined): boolean {
	if (!address) return false;
	const host = address
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, '');
	if (host === 'localhost' || host.endsWith('.local')) return true;
	const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (v4) {
		const [a, b] = [Number(v4[1]), Number(v4[2])];
		return (
			a === 10 ||
			a === 127 ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 169 && b === 254) ||
			(a === 100 && b >= 64 && b <= 127) // CGNAT / Tailscale
		);
	}
	if (host.includes(':')) {
		return host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd');
	}
	return false;
}

interface RawDevice {
	name: string;
	clientIdentifier: string;
	provides: string[];
	connections: PlexConnection[];
}

function decodeXmlEntities(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;|&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

function toConnection(raw: { uri?: string; address?: string; port?: string | number; local?: unknown }): PlexConnection | null {
	const address = raw.address;
	if (!address) return null;
	const port = Number.parseInt(String(raw.port ?? '32400'), 10) || 32400;
	const local = raw.local === true || raw.local === '1' || raw.local === 1;
	const uri = raw.uri || `${local ? 'http' : 'https'}://${address}:${port}`;
	if (!/^https?:\/\/.+/.test(uri)) return null;
	return { uri, address, port, local };
}

function parseResourcesJson(data: any): RawDevice[] {
	const resources: any[] = Array.isArray(data) ? data : data?.MediaContainer?.Device || [];
	return resources.map((r) => {
		const provides = r.provides || r.capabilities || [];
		const conns = r.Connection || r.connections || [];
		return {
			name: r.name,
			clientIdentifier: r.clientIdentifier || r.machineIdentifier,
			provides: (Array.isArray(provides) ? provides : String(provides).split(',')).concat(r.server ? ['server'] : []),
			connections: (Array.isArray(conns) ? conns : [conns]).map(toConnection).filter((c): c is PlexConnection => c != null),
		};
	});
}

function parseResourcesXml(xml: string): RawDevice[] {
	const attr = (tag: string, name: string) => {
		const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
		return m ? decodeXmlEntities(m[1]) : undefined;
	};
	return Array.from(xml.matchAll(/<Device\b[^>]*>[\s\S]*?<\/Device>/g)).flatMap((match) => {
		const deviceXml = match[0];
		const openTag = deviceXml.slice(0, deviceXml.indexOf('>') + 1);
		const name = attr(openTag, 'name');
		const clientIdentifier = attr(openTag, 'clientIdentifier');
		if (!name || !clientIdentifier) return [];
		const connections = Array.from(deviceXml.matchAll(/<Connection\b[^>]*\/?>/g))
			.map((c) =>
				toConnection({
					uri: attr(c[0], 'uri'),
					address: attr(c[0], 'address'),
					port: attr(c[0], 'port'),
					local: attr(c[0], 'local'),
				}),
			)
			.filter((c): c is PlexConnection => c != null);
		return [{ name, clientIdentifier, provides: (attr(openTag, 'provides') ?? '').split(','), connections }];
	});
}

class PlexDiscoveryService {
	/**
	 * Discover available Plex servers using the Plex.tv API. Every server and every connection is
	 * probed in parallel (3 s timeout each), so discovery takes ~one timeout instead of one per URI.
	 */
	async discoverServers(plexToken: string): Promise<PlexDiscoveryResult> {
		try {
			console.log('🔍 Discovering Plex servers...');

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

			const contentType = response.headers.get('content-type') || '';
			const responseText = await response.text();
			// /api/resources usually answers XML even when JSON is requested; handle both into one shape.
			const devices =
				contentType.includes('xml') || responseText.trim().startsWith('<')
					? parseResourcesXml(responseText)
					: parseResourcesJson(JSON.parse(responseText));

			const serverDevices = devices.filter((d) => d.provides.includes('server') && d.connections.length > 0);
			const built = await Promise.all(serverDevices.map((d) => this.buildServer(d, plexToken)));
			const servers = built.map((b) => b.server);

			// Recommend the first server that actually answered, not just the first in the list.
			const recommendedServer = built.find((b) => b.reachable)?.server ?? servers[0];
			console.log(`   Found ${servers.length} server(s); recommended: ${recommendedServer?.name ?? 'none'}`);

			return { servers, recommendedServer };
		} catch (error) {
			console.error('❌ Server discovery failed:', error);
			return {
				servers: [],
				error: error instanceof Error ? error.message : 'Unknown error during server discovery',
			};
		}
	}

	/**
	 * Pick the best connection for a device: probe all advertised connections concurrently and prefer
	 * local over remote. If none answer, try plain http://address:port for private-range addresses only
	 * (*.plex.direct DNS can fail for new/local-only servers; HTTP to a public address would leak the token).
	 */
	private async buildServer(device: RawDevice, plexToken: string): Promise<{ server: PlexServer; reachable: boolean }> {
		const sorted = [...device.connections].sort((a, b) => (a.local === b.local ? 0 : a.local ? -1 : 1));
		const results = await Promise.all(sorted.map((c) => this.testConnectionUri(c.uri, plexToken)));
		let best: PlexConnection | undefined = sorted.find((_, i) => results[i]);

		if (!best) {
			const tried = new Set(sorted.map((c) => c.uri));
			const direct = sorted
				.filter((c) => c.address && isPrivateAddress(c.address))
				.map((c) => ({ uri: `http://${c.address}:${c.port}`, address: c.address, port: c.port, local: true }))
				.filter((c, i, arr) => !tried.has(c.uri) && arr.findIndex((x) => x.uri === c.uri) === i);
			const directResults = await Promise.all(direct.map((c) => this.testConnectionUri(c.uri, plexToken)));
			best = direct.find((_, i) => directResults[i]);
		}

		const chosen = best ?? sorted[0];
		return {
			reachable: !!best,
			server: {
				id: device.clientIdentifier,
				name: device.name,
				uri: chosen.uri,
				serverId: device.clientIdentifier,
				local: chosen.local,
				address: chosen.address,
				port: chosen.port,
				connections: device.connections,
			},
		};
	}

	/**
	 * Quick connectivity test for a single URI (short timeout)
	 */
	private async testConnectionUri(uri: string, plexToken?: string): Promise<boolean> {
		try {
			const testUrl = new URL(`${uri}/identity`);
			if (plexToken) {
				testUrl.searchParams.set('X-Plex-Token', plexToken);
			}

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 3000);

			const response = await fetch(testUrl.toString(), {
				headers: { Accept: 'application/json' },
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Test connection to a specific Plex server (tries all stored connections)
	 */
	async testServerConnection(server: PlexServer, plexToken?: string): Promise<boolean> {
		console.log(`🔗 Testing connection to ${server.name}...`);

		// Try the primary URI first
		if (await this.testConnectionUri(server.uri, plexToken)) {
			// console.log(`✅ Server ${server.name}: Connected via ${server.uri}`);
			return true;
		}

		// Primary failed — try all stored connections
		if (server.connections?.length) {
			for (const conn of server.connections) {
				if (conn.uri === server.uri) continue; // already tried
				if (await this.testConnectionUri(conn.uri, plexToken)) {
					// Update server to use the working connection
					// console.log(`✅ Server ${server.name}: Connected via fallback ${conn.uri}`);
					server.uri = conn.uri;
					server.address = conn.address;
					server.port = conn.port;
					server.local = conn.local;
					return true;
				}
			}

			// Last resort: try plain http://address:port for local connections
			// (*.plex.direct DNS may not resolve for new/local-only servers)
			const triedUris = new Set([server.uri, ...server.connections.map((c) => c.uri)]);
			for (const conn of server.connections) {
				if (!conn.address || !isPrivateAddress(conn.address)) continue;
				const directUri = `http://${conn.address}:${conn.port}`;
				if (triedUris.has(directUri)) continue;
				console.log(`🔗 Trying direct HTTP fallback: ${directUri}`);
				if (await this.testConnectionUri(directUri, plexToken)) {
					// console.log(`✅ Server ${server.name}: Connected via direct HTTP ${directUri}`);
					server.uri = directUri;
					server.address = conn.address;
					server.port = conn.port;
					server.local = true;
					return true;
				}
			}
		}

		console.error(`❌ Connection test failed for ${server.name} (all connections exhausted)`);
		return false;
	}
}

export const plexDiscoveryService = new PlexDiscoveryService();
