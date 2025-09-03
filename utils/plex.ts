import { XMLParser } from 'fast-xml-parser';
import type { Song } from '@/types/song';

const PLEX_SERVER = process.env.EXPO_PUBLIC_PLEX_SERVER!;
const PLEX_TOKEN = process.env.EXPO_PUBLIC_PLEX_TOKEN!;
const PLEX_MUSIC_SECTION_ID = process.env.EXPO_PUBLIC_PLEX_MUSIC_SECTION_ID!;

export const buildPlexURL = (path: string, params: Record<string, string> = {}) => {
	const url = new URL(`${PLEX_SERVER}${path}`);
	url.searchParams.set('X-Plex-Token', PLEX_TOKEN!);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url.toString();
};

export const fetchAllTracks = async (): Promise<Song[]> => {
	const url = buildPlexURL(`/library/sections/${PLEX_MUSIC_SECTION_ID}/all`, {
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

	const tracks = (Array.isArray(rawTracks) ? rawTracks : [rawTracks]).map(formatPlexTrack);

	return tracks;
};

const formatPlexTrack = (track: any): Song => {
	const mediaPart = track.Media?.Part;
	const partKey = mediaPart?.key;
	const duration = parseInt(track.duration || mediaPart?.duration || '0', 10);

	const streamUrl = partKey ? buildPlexURL(partKey) : '';

	return {
		id: track.ratingKey,
		title: track.title,
		artist: track.grandparentTitle,
		album: track.parentTitle,
		artworkUrl: track.thumb ? buildPlexURL(track.thumb) : undefined,
		artwork: '', // Optional: cache this later
		streamUrl: streamUrl, // Use raw part file path
		uri: streamUrl, // Use the stream URL as the URI for playback
		duration,
		trackNumber: parseInt(track.index || '0', 10),
		discNumber: parseInt(track.parentIndex || '0', 10),
		artistKey: '', // Normalize later
	};
};
