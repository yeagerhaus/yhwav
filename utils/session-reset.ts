import { isAvailable, YhwavAudioModule } from '@/modules/yhwav-audio';

/**
 * Wipe everything tied to the signed-in Plex account: library cache and store, playback state, pending
 * scrobbles, UltraBlur colors and the native audio file cache. Downloads are only removed when asked
 * (they can be large and the user may sign back into the same account).
 *
 * Modules are required lazily: this is called from plex-auth, which most of these import.
 */
export async function resetUserData(options: { removeDownloads?: boolean } = {}): Promise<void> {
	const { clearLibraryCache } = require('@/utils/cache');
	const { useLibraryStore } = require('@/hooks/useLibraryStore');
	const { useAudioStore } = require('@/hooks/useAudioStore');
	const { clearPendingScrobbles } = require('@/utils/scrobble-queue');
	const { clearUltraBlurCache } = require('@/hooks/useUltraBlurColors');

	try {
		await useAudioStore.getState().unloadPlayer();
	} catch (error) {
		console.warn('Reset: failed to unload player:', error);
	}

	clearLibraryCache();
	useLibraryStore.setState({
		tracks: [],
		songsById: {},
		albums: [],
		albumsById: {},
		artists: [],
		artistsById: {},
		playlists: [],
		playlistsById: {},
		recentlyPlayed: [],
		hubs: [],
	});

	clearPendingScrobbles();
	clearUltraBlurCache();

	if (isAvailable() && YhwavAudioModule?.clearAudioCache) {
		await YhwavAudioModule.clearAudioCache().catch(() => {});
	}

	if (options.removeDownloads) {
		const { useMusicDownloadsStore } = require('@/hooks/useMusicDownloadsStore');
		const { usePodcastDownloadsStore } = require('@/hooks/usePodcastDownloadsStore');
		await Promise.all([
			useMusicDownloadsStore.getState().removeAllDownloads(),
			usePodcastDownloadsStore.getState().removeAllDownloads(),
		]).catch((error) => console.warn('Reset: failed to remove downloads:', error));
	}
}
