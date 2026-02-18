import { useMemo } from 'react';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import type { Album, Artist, Playlist, Song } from '@/types';

/** Extract the ratingKey from a Plex path like "/library/metadata/83353" → "83353" */
function normalizeArtistKey(key: string): string {
	return key.split('/').pop() || key;
}

/**
 * When offline mode is on, returns only tracks/albums/artists/recentlyPlayed that are
 * downloaded. Also checks the music downloads store so tracks downloaded via the
 * download manager are included without mutating Song objects in the library.
 *
 * Uses persisted artist/album metadata (snapshotted at download time) so offline
 * screens show full metadata (images, genres, year, etc.). Falls back to synthesis
 * from download records when no snapshot exists.
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
	const downloadedArtists = useMusicDownloadsStore((s) => s.downloadedArtists);
	const downloadedAlbums = useMusicDownloadsStore((s) => s.downloadedAlbums);

	return useMemo(() => {
		if (!isOffline) {
			return { tracks, albums, artists, recentlyPlayed, playlists };
		}

		const isTrackDownloaded = (t: Song) => t.isDownloaded || t.localUri || !!musicDownloads[t.id];

		const downloadedTracks = tracks.filter(isTrackDownloaded);
		const downloadedAlbumKeys = new Set(downloadedTracks.map((t) => `${t.album}\0${t.artist}`));
		const downloadedArtistKeys = new Set(downloadedTracks.map((t) => normalizeArtistKey(t.artistKey)));
		const filteredRecentlyPlayed = recentlyPlayed.filter(isTrackDownloaded);

		// --- Albums: prefer library, fill gaps from persisted snapshots, synthesize remainder ---
		const filteredLibraryAlbums = albums.filter((a) => downloadedAlbumKeys.has(`${a.title}\0${a.artist}`));
		const coveredAlbumKeys = new Set(filteredLibraryAlbums.map((a) => `${a.title}\0${a.artist}`));
		const extraAlbums: Album[] = [];
		// Check persisted album snapshots for any album not already covered by library
		for (const album of Object.values(downloadedAlbums)) {
			const k = `${album.title}\0${album.artist}`;
			if (downloadedAlbumKeys.has(k) && !coveredAlbumKeys.has(k)) {
				extraAlbums.push(album);
				coveredAlbumKeys.add(k);
			}
		}
		// Synthesize from download records for anything still missing
		for (const dl of Object.values(musicDownloads)) {
			const k = `${dl.album}\0${dl.artist}`;
			if (!coveredAlbumKeys.has(k)) {
				coveredAlbumKeys.add(k);
				extraAlbums.push({
					id: dl.albumId || `dl-${encodeURIComponent(dl.album)}-${encodeURIComponent(dl.artist)}`,
					title: dl.album,
					artist: dl.artist,
					artistKey: dl.artistKey ? normalizeArtistKey(dl.artistKey) : '',
					artwork: dl.artworkUrl || '',
					thumb: dl.artworkUrl,
				});
			}
		}
		const finalAlbums = [...filteredLibraryAlbums, ...extraAlbums];

		// --- Artists: prefer library, fill gaps from persisted snapshots, synthesize remainder ---
		const filteredLibraryArtists = artists.filter((a) => downloadedArtistKeys.has(a.key));
		const coveredArtistKeys = new Set(filteredLibraryArtists.map((a) => a.key));
		const extraArtists: Artist[] = [];
		for (const artist of Object.values(downloadedArtists)) {
			if (downloadedArtistKeys.has(artist.key) && !coveredArtistKeys.has(artist.key)) {
				extraArtists.push(artist);
				coveredArtistKeys.add(artist.key);
			}
		}
		for (const dl of Object.values(musicDownloads)) {
			const normKey = dl.artistKey ? normalizeArtistKey(dl.artistKey) : '';
			if (normKey && !coveredArtistKeys.has(normKey)) {
				coveredArtistKeys.add(normKey);
				extraArtists.push({
					key: normKey,
					name: dl.artist,
					genres: [],
				});
			}
		}
		const finalArtists = [...filteredLibraryArtists, ...extraArtists];

		// --- Playlists from persisted playlist store ---
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
	}, [isOffline, tracks, albums, artists, recentlyPlayed, playlists, musicDownloads, downloadedPlaylists, downloadedArtists, downloadedAlbums]);
}
