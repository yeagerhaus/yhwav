import AlbumItem from './AlbumItem';
import ListItem from './ListItem';
import PlaylistItem from './PlaylistItem';
import SongItem from './SongItem';

export interface DynamicItemProps {
	type: 'list' | 'playlist' | 'album' | 'song';
	item: any;
	onPress?: any;
	queue?: any[];
	listItem?: boolean;
}

export function DynamicItem({ item, type, onPress, queue, listItem }: DynamicItemProps) {
	switch (type) {
		case 'list':
			return <ListItem item={item} onPress={onPress} />;
		case 'playlist':
			return <PlaylistItem item={item} />;
		case 'album':
			return <AlbumItem item={item} />;
		case 'song':
			return <SongItem item={item} queue={queue} listItem={listItem} />;
		default:
			return null;
	}
}
