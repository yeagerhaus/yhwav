import { useAudioStore } from '@/hooks/useAudioStore';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';

export type SongDownloadStatus = 'none' | 'queued' | 'downloading' | 'downloaded';

/**
 * Per-row playback state as booleans, so a list row only re-renders when *its* state flips (not on
 * every track change or play/pause anywhere in the app).
 */
export function useSongPlayingState(songId: string): { isCurrent: boolean; showAsPlaying: boolean } {
	const isCurrent = useAudioStore((s) => s.currentSong?.id === songId);
	const showAsPlaying = useAudioStore((s) => s.currentSong?.id === songId && (s.isPlaying || s.isBuffering));
	return { isCurrent, showAsPlaying };
}

/** One O(1) selector for a row's download status. */
export function useSongDownloadStatus(songId: string): SongDownloadStatus {
	return useMusicDownloadsStore((s) =>
		s.downloads[songId] ? 'downloaded' : s.downloading.has(songId) ? 'downloading' : s.queuedIds.has(songId) ? 'queued' : 'none',
	);
}
