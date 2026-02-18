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

/** Persisted metadata for a downloaded episode (shown in feed when offline). */
export interface PodcastDownload {
	episodeId: string;
	/** Same as episodeId, for list/key compatibility with PodcastEpisode */
	id: string;
	feedId: string;
	localUri: string;
	title: string;
	showTitle: string;
	pubDate?: string;
	durationSeconds?: number;
	imageUrl?: string;
	downloadedAt: number;
	/** Resume position in seconds; persisted with download so playback always has it. */
	resumeAt?: number;
}

function isPodcastDownload(ep: PodcastEpisode | PodcastDownload): ep is PodcastDownload {
	return 'downloadedAt' in ep && 'localUri' in ep;
}

/** Build a Song-compatible object for playSound from a podcast episode and feed. */
export function toPlayableSong(
	episode: PodcastEpisode | PodcastDownload,
	showTitle: string,
	showImageUrl?: string,
	localUri?: string,
): Song {
	const resolvedUri = localUri ?? (isPodcastDownload(episode) ? episode.localUri : episode.enclosureUrl);
	return {
		id: episode.id,
		title: episode.title,
		artist: showTitle,
		artistKey: episode.feedId,
		album: showTitle,
		artwork: episode.imageUrl || showImageUrl || '',
		artworkUrl: episode.imageUrl || showImageUrl,
		uri: resolvedUri,
		localUri: localUri ?? (isPodcastDownload(episode) ? episode.localUri : undefined),
		isDownloaded: !!localUri || isPodcastDownload(episode),
		duration: episode.durationSeconds ?? 0,
		trackNumber: 0,
		discNumber: 0,
		source: 'podcast',
	};
}
