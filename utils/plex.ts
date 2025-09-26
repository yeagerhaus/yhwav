import { XMLParser } from 'fast-xml-parser';
import type { Song } from '@/types/song';
import { plexJWTService } from './plex-jwt';

// Initialize JWT service on module load
let jwtInitialized = false;
const initializeJWT = async () => {
	if (!jwtInitialized) {
		await plexJWTService.initialize();
		jwtInitialized = true;
	}
};

const PLEX_SERVER = process.env.EXPO_PUBLIC_PLEX_SERVER!;
const PLEX_MUSIC_SECTION_ID = process.env.EXPO_PUBLIC_PLEX_MUSIC_SECTION_ID!;

export const buildPlexURL = async (path: string, params: Record<string, string> = {}) => {
	// Initialize JWT service if not already done
	await initializeJWT();

	const url = new URL(`${PLEX_SERVER}${path}`);

	// Get JWT token (will refresh if needed)
	const token = await plexJWTService.getValidToken();
	url.searchParams.set('X-Plex-Token', token);

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url.toString();
};

export const fetchAllTracks = async (): Promise<Song[]> => {
	const url = await buildPlexURL(`/library/sections/${PLEX_MUSIC_SECTION_ID}/all`, {
		type: '10', // 10 = track
		sort: 'titleSort:asc',
	});

	const res = await fetch(url);
	const text = await res.text();

	const parser = new XMLParser({
		ignoreAttributes: false,
		htmlEntities: true,
		attributeNamePrefix: '', // so @title becomes just `title`
	});

	const parsed = parser.parse(text);
	const rawTracks = parsed?.MediaContainer?.Track || [];

	const tracks = await Promise.all((Array.isArray(rawTracks) ? rawTracks : [rawTracks]).map(formatPlexTrack));

	return tracks;
};

const formatPlexTrack = async (track: any): Promise<Song> => {
	const mediaPart = track.Media?.Part;
	const partKey = mediaPart?.key;
	const duration = parseInt(track.duration || mediaPart?.duration || '0', 10);

	const streamUrl = partKey ? await buildPlexURL(partKey) : '';

	return {
		id: track.ratingKey,
		title: track.title,
		artist: track.grandparentTitle,
		album: track.parentTitle,
		artworkUrl: track.thumb ? await buildPlexURL(track.thumb) : undefined,
		artwork: '', // Optional: cache this later
		streamUrl: streamUrl, // Use raw part file path
		uri: streamUrl, // Use the stream URL as the URI for playback
		duration,
		trackNumber: parseInt(track.index || '0', 10),
		discNumber: parseInt(track.parentIndex || '0', 10),
		artistKey: '', // Normalize later
	};
};

// Export JWT service for manual initialization if needed
export { plexJWTService };

// Utility function to manually initialize JWT (useful for app startup)
export const initializePlexJWT = async (): Promise<void> => {
	await initializeJWT();
};

// Utility function to clear JWT auth data
export const clearPlexAuth = async (): Promise<void> => {
	await plexJWTService.clearAuth();
	jwtInitialized = false;
};
