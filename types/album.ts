export interface Album {
	id: string;
	title: string;
	artist: string;
	artistKey: string;
	artwork: string;
	thumb?: string;
	year?: number;
	addedAt?: number;
	format?: string;
	subformat?: string;
	originallyAvailableAt?: string;
}
