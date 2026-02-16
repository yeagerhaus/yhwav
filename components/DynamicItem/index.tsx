import AlbumItem from './AlbumItem';
import ArtistItem from './ArtistItem';
import LargeSongItem from './LargeSongItem';
import ListItem from './ListItem';
import PlaylistItem from './PlaylistItem';
import SongItem from './SongItem';

export interface DynamicItemProps {
	type: 'list' | 'playlist' | 'album' | 'artist' | 'song' | 'largeSong';
	item: any;
	onPress?: any;
	queue?: any[];
	listItem?: boolean;
	size?: number;
}

export function DynamicItem({ item, type, onPress, queue, listItem, size }: DynamicItemProps) {
	switch (type) {
		case 'list':
			return <ListItem item={item} onPress={onPress} />;
		case 'playlist':
			return <PlaylistItem item={item} size={size} />;
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
