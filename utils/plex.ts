import { XMLParser } from 'fast-xml-parser';
import { Song } from '@/types/song';

const PLEX_SERVER = process.env.PLEX_SERVER!;
const PLEX_TOKEN = process.env.PLEX_TOKEN!;
const PLEX_MUSIC_SECTION_ID = process.env.PLEX_MUSIC_SECTION_ID || '9';

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

	const parser = new XMLParser();
	const parsed = parser.parse(text);
	const rawTracks = parsed?.MediaContainer?.Track || [];

	const tracks = (Array.isArray(rawTracks) ? rawTracks : [rawTracks]).map(formatPlexTrack);

	return tracks;
};

const formatPlexTrack = (track: any): Song => ({
	id: `plex-${track.ratingKey}`,
	title: track.title,
	artist: track.grandparentTitle,
	album: track.parentTitle,
	streamUrl: buildPlexURL(`/music/${track.ratingKey}/file`),
	artworkUrl: track.thumb ? buildPlexURL(track.thumb) : undefined,
	artistKey: '',
	artwork: '',
	uri: '',
	duration: 0,
	trackNumber: 0,
	discNumber: 0
});
