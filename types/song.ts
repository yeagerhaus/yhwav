export interface Song {
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
	playlistIndex?: number;
	localUri?: string;
	isDownloaded?: boolean;
}
