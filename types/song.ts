export type Song = {
	id: string;
	title: string;
	artist: string;
	artistKey: string;
	album: string;
	artwork: string;
	uri: string;
	streamUrl?: string;
	artworkUrl?: string;
	duration: number;
	trackNumber: number;
	discNumber: number;
	playlistItemId?: string;
	playlistIndex?: number;
	localUri?: string;
	isDownloaded?: boolean;
	// Pre-computed for search (avoids 126k allocations per query)
	titleLower?: string;
	artistLower?: string;
	albumLower?: string;
	// When set, player UI shows podcast controls (15s skip, speed; no queue/next/prev)
	source?: 'podcast';
};
