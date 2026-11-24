import { create } from 'zustand';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import type { Album, Artist, Playlist, Song } from '@/types';

/** Extract the ratingKey from a Plex path like "/library/metadata/83353" → "83353" */
function normalizeArtistKey(key: string): string {
	return key.split('/').pop() || key;
}

type FilteredLibrary = {
	tracks: Song[];
	albums: Album[];
	artists: Artist[];
	recentlyPlayed: Song[];
	playlists: Playlist[];
};

/** Inputs the filtered view depends on; recomputation happens only when one of these references changes. */
type Inputs = {
	isOffline: boolean;
	tracks: Song[];
	albums: Album[];
	artists: Artist[];
	recentlyPlayed: Song[];
	playlists: Playlist[];
	musicDownloads: ReturnType<typeof useMusicDownloadsStore.getState>['downloads'];
	downloadedPlaylists: ReturnType<typeof useMusicDownloadsStore.getState>['downloadedPlaylists'];
	downloadedArtists: ReturnType<typeof useMusicDownloadsStore.getState>['downloadedArtists'];
	downloadedAlbums: ReturnType<typeof useMusicDownloadsStore.getState>['downloadedAlbums'];
};

function readInputs(): Inputs {
	const lib = useLibraryStore.getState();
	const dl = useMusicDownloadsStore.getState();
	return {
		isOffline: useOfflineModeStore.getState().offlineMode,
		tracks: lib.tracks,
		albums: lib.albums,
		artists: lib.artists,
		recentlyPlayed: lib.recentlyPlayed,
		playlists: lib.playlists,
		musicDownloads: dl.downloads,
		downloadedPlaylists: dl.downloadedPlaylists,
		downloadedArtists: dl.downloadedArtists,
		downloadedAlbums: dl.downloadedAlbums,
	};
}

function compute(inputs: Inputs): FilteredLibrary {
	const {
		isOffline,
		tracks,
		albums,
		artists,
		recentlyPlayed,
		playlists,
		musicDownloads,
		downloadedPlaylists,
		downloadedArtists,
		downloadedAlbums,
	} = inputs;

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
}

function inputsChanged(prev: Inputs, next: Inputs): boolean {
	if (prev.isOffline !== next.isOffline) return true;
	if (
		prev.tracks !== next.tracks ||
		prev.albums !== next.albums ||
		prev.artists !== next.artists ||
		prev.recentlyPlayed !== next.recentlyPlayed ||
		prev.playlists !== next.playlists
	) {
		return true;
	}
	// Download changes only matter while offline (online, the full library is shown as-is). This keeps
	// library screens from re-rendering on every completed download during a batch.
	return (
		next.isOffline &&
		(prev.musicDownloads !== next.musicDownloads ||
			prev.downloadedPlaylists !== next.downloadedPlaylists ||
			prev.downloadedArtists !== next.downloadedArtists ||
			prev.downloadedAlbums !== next.downloadedAlbums)
	);
}

let lastInputs = readInputs();

/** Single shared derived view (computed once, not per mounted screen). */
const useFilteredLibraryStore = create<{ value: FilteredLibrary }>(() => ({ value: compute(lastInputs) }));

function recompute() {
	const next = readInputs();
	if (!inputsChanged(lastInputs, next)) return;
	lastInputs = next;
	useFilteredLibraryStore.setState({ value: compute(next) });
}

useLibraryStore.subscribe(recompute);
useMusicDownloadsStore.subscribe(recompute);
useOfflineModeStore.subscribe(recompute);

/**
 * When offline mode is on, returns only tracks/albums/artists/recentlyPlayed that are downloaded (plus
 * downloaded playlists), using persisted artist/album snapshots for full metadata and synthesizing the
 * rest from download records. Online, returns the library arrays unchanged.
 *
 * Backed by one shared derived store, so every screen reads the same memoized result.
 */
export function useOfflineFilteredLibrary(): FilteredLibrary {
	return useFilteredLibraryStore((s) => s.value);
}
