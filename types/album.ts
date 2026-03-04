export type Album = {
	id: string;
	title: string;
	artist: string;
	artistKey: string;
	artwork: string;
	thumb?: string;
	year?: number;
	addedAt?: number;
	/** Plex GUID, e.g. "plex://album/..." */
	guid?: string;
	/** Record label / studio */
	studio?: string;
	/** Track count (leafCount from Plex, not always present in bulk list responses) */
	leafCount?: number;
	originallyAvailableAt?: string;
};
