import GridItem from "./GridItem";
import ListItem from "./ListItem";
import SongItem from "./SongItem";


export interface DynamicItemProps {
	type: 'list' | 'grid' | 'song';
	item: any;
	onPress?: any;
	queue?: any[];
}

export function DynamicItem({ item, type, onPress, queue }: DynamicItemProps) {
	switch (type) {
		case 'list':
			return <ListItem item={item} onPress={onPress} />;
		case 'grid':
			return <GridItem item={item} />;
		case 'song':
			return <SongItem item={item} queue={queue} />;
		default:
			return null;
	}
}
