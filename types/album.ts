export interface Album {
	id: string;
	title: string;
	artist: string;
	artistKey: string;
	songIds: string[];
	artwork: string;
	year?: number;
}
