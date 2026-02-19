export interface Playlist {
	id: string;
	title: string;
	summary?: string;
	playlistType: 'audio' | 'video' | 'photo';
	artworkUrl?: string;
	artwork?: string;
	duration?: number;
	leafCount?: number;
	createdAt?: string;
	updatedAt?: string;
	lastViewedAt?: number;
	smart?: boolean;
	composite?: string;
	ratingKey: string;
	key: string;
	guid?: string;
	addedAt?: string;
}
