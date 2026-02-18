import { useMemo } from 'react';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import type { Album, Artist, Playlist, Song } from '@/types';

/**
 * When offline mode is on, returns only tracks/albums/artists/recentlyPlayed that are
 * downloaded. Also checks the music downloads store so tracks downloaded via the
 * download manager are included without mutating Song objects in the library.
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
	const musicDownloads = useMusicDownloadsStore((s) => s.downloads);

	return useMemo(() => {
		if (!isOffline) {
			return { tracks, albums, artists, recentlyPlayed, playlists };
		}

		const isTrackDownloaded = (t: Song) => t.isDownloaded || t.localUri || !!musicDownloads[t.id];

		const downloadedTracks = tracks.filter(isTrackDownloaded);
		const downloadedAlbumKeys = new Set(downloadedTracks.map((t) => `${t.album}\0${t.artist}`));
		const downloadedArtistKeys = new Set(downloadedTracks.map((t) => t.artistKey));
		const filteredAlbums = albums.filter((a) => downloadedAlbumKeys.has(`${a.title}\0${a.artist}`));
		const filteredArtists = artists.filter((a) => downloadedArtistKeys.has(a.key));
		const filteredRecentlyPlayed = recentlyPlayed.filter(isTrackDownloaded);

		const downloadedSongIds = new Set(Object.keys(musicDownloads));
		const filteredPlaylists = playlists.filter((p) => {
			const playlistTracks = tracks.filter(
				(t) => t.playlistItemId != null && downloadedSongIds.has(t.id),
			);
			return playlistTracks.length > 0;
		});

		return {
			tracks: downloadedTracks,
			albums: filteredAlbums,
			artists: filteredArtists,
			recentlyPlayed: filteredRecentlyPlayed,
			playlists: filteredPlaylists,
		};
	}, [isOffline, tracks, albums, artists, recentlyPlayed, playlists, musicDownloads]);
}
