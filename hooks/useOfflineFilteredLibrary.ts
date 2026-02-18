import { useMemo } from 'react';
import type { Album, Artist, Playlist, Song } from '@/types';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';

/**
 * When offline mode is on, returns only tracks/albums/artists/recentlyPlayed that are
 * downloaded (isDownloaded or localUri). Playlists are empty when offline
 * since we can't know their contents without fetching.
 */
export function useOfflineFilteredLibrary(): {
	tracks: Song[];
	albums: Album[];
	artists: Artist[];
	recentlyPlayed: Song[];
	playlists: Playlist[];
} {
	const tracks = useLibraryStore((s) => s.tracks);
	const albums = useLibraryStore((s) => s.albums);
	const artists = useLibraryStore((s) => s.artists);
	const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
	const playlists = useLibraryStore((s) => s.playlists);
	const isOffline = useOfflineModeStore((s) => s.offlineMode);

	return useMemo(() => {
		if (!isOffline) {
			return { tracks, albums, artists, recentlyPlayed, playlists };
		}
		const downloadedTracks = tracks.filter((t) => t.isDownloaded || t.localUri);
		const downloadedAlbumKeys = new Set(
			downloadedTracks.map((t) => `${t.album}\0${t.artist}`),
		);
		const downloadedArtistKeys = new Set(downloadedTracks.map((t) => t.artistKey));
		const filteredAlbums = albums.filter((a) =>
			downloadedAlbumKeys.has(`${a.title}\0${a.artist}`),
		);
		const filteredArtists = artists.filter((a) => downloadedArtistKeys.has(a.key));
		const filteredRecentlyPlayed = recentlyPlayed.filter(
			(s) => s.isDownloaded || s.localUri,
		);
		// Playlist contents require fetch; when offline we show no playlists
		return {
			tracks: downloadedTracks,
			albums: filteredAlbums,
			artists: filteredArtists,
			recentlyPlayed: filteredRecentlyPlayed,
			playlists: [],
		};
	}, [isOffline, tracks, albums, artists, recentlyPlayed, playlists]);
}
