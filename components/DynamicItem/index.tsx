import AlbumItem from './AlbumItem';
import ArtistItem from './ArtistItem';
import LargeSongItem from './LargeSongItem';
import ListItem from './ListItem';
import PlaylistItem from './PlaylistItem';
import PodcastShowItem from './PodcastShowItem';
import SongItem from './SongItem';
import PodcastEpisodeItem from './PodcastEpisodeItem';

import type { PodcastFeed } from '@/types/podcast';

export interface DynamicItemProps {
	type: 'list' | 'playlist' | 'podcast' | 'podcastEpisode' | 'album' | 'artist' | 'song' | 'largeSong';
	item: any;
	onPress?: any;
	queue?: any[];
	listItem?: boolean;
	size?: number;
	showTitle?: string;
	showImageUrl?: string;
	/** For podcastEpisode: enables download/remove-download button */
	feed?: PodcastFeed;
}

export function DynamicItem({ item, type, onPress, queue, listItem, size, showTitle, showImageUrl, feed }: DynamicItemProps) {
	switch (type) {
		case 'list':
			return <ListItem item={item} onPress={onPress} />;
		case 'playlist':
			return <PlaylistItem item={item} size={size} />;
		case 'podcast':
			return <PodcastShowItem item={item} size={size} />;
		case 'podcastEpisode':
			return (
				<PodcastEpisodeItem
					episode={item}
					showTitle={showTitle ?? ''}
					showImageUrl={showImageUrl}
					queue={queue}
					listItem={listItem}
					feed={feed}
				/>
			);
		case 'album':
			return <AlbumItem item={item} size={size} />;
		case 'artist':
			return <ArtistItem item={item} />;
		case 'song':
			return <SongItem item={item} queue={queue} listItem={listItem} />;
		case 'largeSong':
			return <LargeSongItem item={item} queue={queue} size={size} />;
		default:
			return null;
	}
}
