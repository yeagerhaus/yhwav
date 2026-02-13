// Re-export everything from the new robust Plex client

export type { PlexError, PlexResponse } from './plex-client';
export {
	buildPlexURL,
	fetchAllAlbums,
	fetchAllArtists,
	fetchAllPlaylists,
	fetchAllTracks,
	fetchPlaylist,
	fetchPlaylistTracks,
	fetchUltraBlurColors,
	plexClient,
	testPlexServer,
} from './plex-client';
