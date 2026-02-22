const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

export interface ITunesPodcastResult {
	trackId: number;
	trackName: string;
	artistName: string;
	artworkUrl100: string;
	artworkUrl600: string;
	feedUrl: string;
	genres: string[];
}

export async function searchPodcasts(query: string, limit = 20): Promise<ITunesPodcastResult[]> {
	if (!query.trim()) return [];

	const params = new URLSearchParams({
		term: query,
		media: 'podcast',
		entity: 'podcast',
		limit: String(limit),
	});

	const res = await fetch(`${ITUNES_SEARCH_URL}?${params}`);
	if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);

	const data = await res.json();
	return (data.results ?? []).filter((r: ITunesPodcastResult) => r.feedUrl);
}
