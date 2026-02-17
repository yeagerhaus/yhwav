import type { Song } from './song';

export interface PodcastFeed {
	id: string;
	url: string;
	title?: string;
	imageUrl?: string;
	addedAt: number;
}

export interface PodcastEpisode {
	id: string;
	feedId: string;
	title: string;
	link?: string;
	pubDate?: string;
	description?: string;
	enclosureUrl: string;
	durationSeconds?: number;
	imageUrl?: string;
}

/** Build a Song-compatible object for playSound from a podcast episode and feed. */
export function toPlayableSong(
	episode: PodcastEpisode,
	showTitle: string,
	showImageUrl?: string,
): Song {
	return {
		id: episode.id,
		title: episode.title,
		artist: showTitle,
		artistKey: episode.feedId,
		album: showTitle,
		artwork: episode.imageUrl || showImageUrl || '',
		artworkUrl: episode.imageUrl || showImageUrl,
		uri: episode.enclosureUrl,
		duration: episode.durationSeconds ?? 0,
		trackNumber: 0,
		discNumber: 0,
		source: 'podcast',
	};
}
