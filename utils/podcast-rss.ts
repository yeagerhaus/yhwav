import { XMLParser } from 'fast-xml-parser';
import type { PodcastEpisode } from '@/types';

export interface ParsedFeed {
	title?: string;
	imageUrl?: string;
	episodes: PodcastEpisode[];
}

/** Parse iTunes-style duration (e.g. "1:23:45", "45:30", or number seconds) to seconds. */
function parseDuration(value: string | number | undefined): number | undefined {
	if (value == null) return undefined;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value !== 'string') return undefined;
	const parts = value.trim().split(':').map(Number);
	if (parts.some(Number.isNaN)) return undefined;
	if (parts.length === 1) return parts[0];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	return undefined;
}

function textOrUndefined(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (value != null && typeof value === 'object' && '#' in value) return (value as { '#': string })['#'];
	return undefined;
}

function first<T>(value: T | T[] | undefined): T | undefined {
	if (value == null) return undefined;
	return Array.isArray(value) ? value[0] : value;
}

export async function fetchAndParseFeed(feedUrl: string, feedId: string): Promise<ParsedFeed> {
	const response = await fetch(feedUrl, {
		headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch feed: ${response.status}`);
	}
	const xml = await response.text();

	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		isArray: (name) => name === 'item' || name === 'entry',
	});
	const parsed = parser.parse(xml);

	// RSS: rss.channel; Atom: feed
	const channel = parsed?.rss?.channel ?? parsed?.feed ?? parsed?.channel;
	if (!channel) {
		throw new Error('Invalid feed: no channel or feed root');
	}

	const rawTitle = channel.title;
	const title = typeof rawTitle === 'string' ? rawTitle : textOrUndefined(first(rawTitle));

	// Channel image: RSS <image><url>, or itunes:image @_href
	const rawImage = channel.image;
	let imageUrl: string | undefined;
	if (typeof rawImage === 'string') {
		imageUrl = rawImage;
	} else if (rawImage != null && typeof rawImage === 'object') {
		imageUrl = rawImage['@_href'] ?? rawImage.url ?? textOrUndefined(first(rawImage.url));
	}
	const rawItunesImage = channel['itunes:image'];
	if (!imageUrl && rawItunesImage) {
		const t =
			typeof rawItunesImage === 'string' ? rawItunesImage : (rawItunesImage['@_href'] ?? textOrUndefined(first(rawItunesImage)));
		if (t) imageUrl = t;
	}

	const items = [
		...(Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : []),
		...(Array.isArray(channel.entry) ? channel.entry : channel.entry ? [channel.entry] : []),
	];

	const episodes: PodcastEpisode[] = [];
	for (let index = 0; index < items.length; index++) {
		const item = items[index];
		const enclosure = first(item?.enclosure) ?? item?.enclosure;
		const enclosureUrl = enclosure?.['@_url'] ?? (typeof enclosure?.url === 'string' ? enclosure.url : undefined);
		if (!enclosureUrl) continue;

		const rawItemTitle = item?.title;
		const itemTitle = typeof rawItemTitle === 'string' ? rawItemTitle : (textOrUndefined(first(rawItemTitle)) ?? 'Untitled');

		const rawLink = item?.link;
		const link = typeof rawLink === 'string' ? rawLink : (rawLink?.['@_href'] ?? textOrUndefined(first(rawLink)));

		const rawGuid = item?.guid ?? item?.id;
		const guid = typeof rawGuid === 'string' ? rawGuid : (textOrUndefined(first(rawGuid)) ?? link ?? `ep-${index}`);
		const id = `${feedId}|${guid}`;

		const rawPubDate = item?.pubDate ?? item?.published ?? item?.updated;
		const pubDate = typeof rawPubDate === 'string' ? rawPubDate : textOrUndefined(first(rawPubDate));

		const rawDesc = item?.description ?? item?.summary ?? item?.content ?? item?.['content:encoded'];
		const description = typeof rawDesc === 'string' ? rawDesc : textOrUndefined(first(rawDesc));

		const rawDuration = item?.['itunes:duration'] ?? item?.duration;
		const durationSeconds = parseDuration(typeof rawDuration === 'string' ? rawDuration : textOrUndefined(first(rawDuration)));

		const rawItemImage = item?.['itunes:image'];
		const itemImageUrl =
			typeof rawItemImage === 'string' ? rawItemImage : (rawItemImage?.['@_href'] ?? textOrUndefined(first(rawItemImage)));

		episodes.push({
			id,
			feedId,
			title: itemTitle,
			link,
			pubDate,
			description,
			enclosureUrl,
			durationSeconds,
			imageUrl: itemImageUrl ?? imageUrl,
		});
	}

	return {
		title,
		imageUrl,
		episodes,
	};
}
