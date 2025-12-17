export * from './cache';
export * from './plex';
export * from './plex-auth';
export * from './plex-discovery';
export * from './styles';

/**
 * Normalize artist name by taking the first artist if multiple are separated by semicolon
 * and converting to lowercase for consistent matching
 */
export function normalizeArtist(artist: string): string {
	return artist?.split(';')[0].trim().toLowerCase() || 'unknown artist';
}
