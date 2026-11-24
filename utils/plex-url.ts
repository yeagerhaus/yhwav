import type { Album, Artist, HomeHub, Playlist, Song } from '@/types';

/**
 * Plex URL persistence.
 *
 * In memory, library objects carry fully-qualified Plex URLs (`https://host:32400/path?X-Plex-Token=…`) so
 * screens can use them directly. On disk they are stored as `plex:/path?…` with the host, token and
 * identity params removed:
 * - the token never sits in plaintext caches, and
 * - the host is re-applied at load time, so a local↔remote connection switch doesn't strand cached URLs.
 */

const PLACEHOLDER = 'plex:';

export interface PlexUrlConnection {
	baseURL: string;
	token: string;
	identityQs: string;
}

/** Base URL that in-memory library URLs were last resolved against (for rebasing on connection change). */
let currentUrlBase = '';

/** Join a path (which may already have a query) with extra query params. */
export function appendQuery(pathOrUrl: string, query: string): string {
	if (!query) return pathOrUrl;
	return `${pathOrUrl}${pathOrUrl.includes('?') ? '&' : '?'}${query}`;
}

/** Build an authenticated URL for a Plex path. */
export function buildAuthedPlexUrl(path: string, conn: PlexUrlConnection): string {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	const auth = conn.token ? `X-Plex-Token=${encodeURIComponent(conn.token)}&${conn.identityQs}` : conn.identityQs;
	return appendQuery(`${conn.baseURL}${normalized}`, auth);
}

/** Strip host, token and X-Plex-* identity params from an authenticated Plex URL. Other URLs are unchanged. */
export function toStoredPlexUrl(url: string | undefined): string | undefined {
	if (!url || !url.includes('X-Plex-Token')) return url;
	const schemeEnd = url.indexOf('://');
	if (schemeEnd === -1) return url;
	const pathStart = url.indexOf('/', schemeEnd + 3);
	if (pathStart === -1) return url;
	const rest = url.slice(pathStart);
	const q = rest.indexOf('?');
	const path = q === -1 ? rest : rest.slice(0, q);
	const kept =
		q === -1
			? []
			: rest
					.slice(q + 1)
					.split('&')
					.filter((p) => p && !p.startsWith('X-Plex-'));
	return `${PLACEHOLDER}${path}${kept.length ? `?${kept.join('&')}` : ''}`;
}

/** Resolve a stored `plex:/…` URL against the given connection. Other values are returned unchanged. */
export function fromStoredPlexUrl(stored: string | undefined, conn: PlexUrlConnection | null): string | undefined {
	if (!stored || !stored.startsWith(`${PLACEHOLDER}/`) || !conn) return stored;
	return buildAuthedPlexUrl(stored.slice(PLACEHOLDER.length), conn);
}

type UrlFn = (url: string | undefined) => string | undefined;

export function mapSongUrls(song: Song, fn: UrlFn): Song {
	return {
		...song,
		uri: fn(song.uri) ?? '',
		streamUrl: fn(song.streamUrl),
		artworkUrl: fn(song.artworkUrl),
		artwork: fn(song.artwork) ?? '',
	};
}

export function mapAlbumUrls(album: Album, fn: UrlFn): Album {
	return { ...album, thumb: fn(album.thumb), artwork: fn(album.artwork) ?? '' };
}

export function mapArtistUrls(artist: Artist, fn: UrlFn): Artist {
	return { ...artist, thumb: fn(artist.thumb), art: fn(artist.art) };
}

export function mapPlaylistUrls(playlist: Playlist, fn: UrlFn): Playlist {
	return { ...playlist, artworkUrl: fn(playlist.artworkUrl), artwork: fn(playlist.artwork) };
}

export function mapHubUrls(hub: HomeHub, fn: UrlFn): HomeHub {
	return {
		...hub,
		tracks: hub.tracks.map((s) => mapSongUrls(s, fn)),
		albums: hub.albums.map((a) => mapAlbumUrls(a, fn)),
		playlists: hub.playlists.map((p) => mapPlaylistUrls(p, fn)),
	};
}

/** URL mapper that swaps one base (scheme+host) for another, leaving everything else intact. */
export function rebaseFn(oldBase: string, newBase: string): UrlFn {
	return (url) => (url?.startsWith(oldBase) ? `${newBase}${url.slice(oldBase.length)}` : url);
}

/**
 * Connection used to resolve stored URLs. Prefers the live client connection; before the client has
 * initialized (e.g. cache hydration at startup) falls back to the selected server + stored token.
 */
export function getUrlConnection(): PlexUrlConnection | null {
	const { plexClient } = require('@/utils/plex-client');
	const { plexAuthService } = require('@/utils/plex-auth');
	const { buildPlexIdentityHeaders, encodePlexIdentityQueryString } = require('@/utils/plex-identity');

	const live = plexClient.getConnectionInfo() as { baseURL: string; token: string } | null;
	const baseURL = live?.baseURL ?? (plexAuthService.getSelectedServer()?.uri as string | undefined)?.replace(/\/$/, '');
	const token = live?.token ?? (plexAuthService.getAccessToken() as string | undefined);
	if (!baseURL || !token) return null;
	const identityQs = encodePlexIdentityQueryString(buildPlexIdentityHeaders(plexAuthService.getClientIdentifier()));
	return { baseURL, token, identityQs };
}

/** Resolver bound to the current connection (computed once per batch). */
export function resolverForCurrentConnection(): UrlFn {
	const conn = getUrlConnection();
	if (conn) currentUrlBase = conn.baseURL;
	return (url) => fromStoredPlexUrl(url, conn);
}

/**
 * Rewrite every in-memory library/playback URL from the old base to the new one. Called when the Plex
 * client switches connections (e.g. local ↔ remote) so artwork and streams keep working.
 */
export function rebaseInMemoryUrls(newBase: string): void {
	const oldBase = currentUrlBase;
	currentUrlBase = newBase;
	if (!oldBase || !newBase || oldBase === newBase) return;

	const fn = rebaseFn(oldBase, newBase);
	const { useLibraryStore } = require('@/hooks/useLibraryStore');
	const lib = useLibraryStore.getState();
	const tracks: Song[] = lib.tracks.map((s: Song) => mapSongUrls(s, fn));
	const songsById: Record<string, Song> = {};
	for (const s of tracks) songsById[s.id] = s;
	const albums: Album[] = lib.albums.map((a: Album) => mapAlbumUrls(a, fn));
	const albumsById: Record<string, Album> = {};
	for (const a of albums) albumsById[a.id] = a;
	const artists: Artist[] = lib.artists.map((a: Artist) => mapArtistUrls(a, fn));
	const artistsById: Record<string, Artist> = {};
	for (const a of artists) artistsById[a.key] = a;
	const playlists: Playlist[] = lib.playlists.map((p: Playlist) => mapPlaylistUrls(p, fn));
	const playlistsById: Record<string, Playlist> = {};
	for (const p of playlists) playlistsById[p.id] = p;
	useLibraryStore.setState({
		tracks,
		songsById,
		albums,
		albumsById,
		artists,
		artistsById,
		playlists,
		playlistsById,
		recentlyPlayed: lib.recentlyPlayed.map((s: Song) => mapSongUrls(s, fn)),
		hubs: lib.hubs.map((h: HomeHub) => mapHubUrls(h, fn)),
	});

	// Queue songs: map through the rebased library objects where possible so identities stay shared.
	const { useAudioStore } = require('@/hooks/useAudioStore');
	const audio = useAudioStore.getState();
	const remap = (s: Song) => songsById[s.id] ?? mapSongUrls(s, fn);
	useAudioStore.setState({
		queue: audio.queue.map(remap),
		originalQueue: audio.originalQueue.map(remap),
		currentSong: audio.currentSong ? remap(audio.currentSong) : null,
	});
	if (__DEV__) console.log(`🔄 Rebased library URLs ${oldBase} → ${newBase}`);
}
