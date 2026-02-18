import { useMemo } from 'react';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import type { Album, Artist, Playlist, Song } from '@/types';

/**
 * When offline mode is on, returns only tracks/albums/artists/recentlyPlayed that are
 * downloaded. Also checks the music downloads store so tracks downloaded via the
 * download manager are included without mutating Song objects in the library.
 *
 * When the library's albums/artists arrays are empty (e.g. app restarted while offline),
 * synthesizes minimal objects from the download metadata so navigation still works.
 *
 * Downloaded playlists are included from the persisted playlist store.
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
	const downloadedPlaylists = useMusicDownloadsStore((s) => s.downloadedPlaylists);

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

		// When the library arrays are empty (app restarted offline), synthesize from downloads
		let finalAlbums = filteredAlbums;
		if (finalAlbums.length === 0 && Object.keys(musicDownloads).length > 0) {
			const albumMap = new Map<string, Album>();
			for (const dl of Object.values(musicDownloads)) {
				const key = `${dl.album}\0${dl.artist}`;
				if (!albumMap.has(key)) {
					albumMap.set(key, {
						id: dl.albumId || `dl-${encodeURIComponent(dl.album)}-${encodeURIComponent(dl.artist)}`,
						title: dl.album,
						artist: dl.artist,
						artistKey: dl.artistKey || '',
						artwork: dl.artworkUrl || '',
						thumb: dl.artworkUrl,
					});
				}
			}
			finalAlbums = Array.from(albumMap.values());
		}

		let finalArtists = filteredArtists;
		if (finalArtists.length === 0 && Object.keys(musicDownloads).length > 0) {
			const artistMap = new Map<string, Artist>();
			for (const dl of Object.values(musicDownloads)) {
				if (dl.artistKey && !artistMap.has(dl.artistKey)) {
					artistMap.set(dl.artistKey, {
						key: dl.artistKey,
						name: dl.artist,
						genres: [],
					});
				}
			}
			finalArtists = Array.from(artistMap.values());
		}

		// Build offline playlists from the persisted playlist store
		const offlinePlaylists: Playlist[] = Object.values(downloadedPlaylists).map((dp) => ({
			id: dp.id,
			key: dp.key,
			ratingKey: dp.ratingKey,
			title: dp.title,
			summary: dp.summary,
			artworkUrl: dp.artworkUrl,
			playlistType: dp.playlistType,
			leafCount: dp.leafCount,
			duration: 0,
		}));

		return {
			tracks: downloadedTracks,
			albums: finalAlbums,
			artists: finalArtists,
			recentlyPlayed: filteredRecentlyPlayed,
			playlists: offlinePlaylists,
		};
	}, [isOffline, tracks, albums, artists, recentlyPlayed, playlists, musicDownloads, downloadedPlaylists]);
}
