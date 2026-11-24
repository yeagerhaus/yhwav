import * as FileSystem from 'expo-file-system/legacy';
import { isAvailable, YhwavAudioModule } from '@/modules/yhwav-audio';

/**
 * Download file locations.
 *
 * Records persist a path RELATIVE to the documents directory (e.g. `music/123.flac`), never an absolute
 * `file:///…/Documents/…` URI: the iOS app container path can change across reinstalls/updates, which
 * would leave every stored absolute path pointing at a directory that no longer exists.
 */
export type DownloadKind = 'music' | 'podcasts';

function documentsRoot(): string {
	return FileSystem.documentDirectory ?? '';
}

/** Absolute directory URI for a download kind (current container). */
export function downloadsDirUri(kind: DownloadKind): string {
	return `${documentsRoot()}${kind}`;
}

/** Relative path (`<kind>/<file>`) from an absolute URI, a legacy absolute record, or an already-relative path. */
export function toRelativeDownloadPath(uriOrPath: string, kind: DownloadKind): string {
	if (!uriOrPath.includes('://') && !uriOrPath.startsWith('/')) return uriOrPath;
	const name = uriOrPath.split('/').filter(Boolean).pop() ?? uriOrPath;
	return `${kind}/${name}`;
}

/** Absolute file URI for a relative download path, resolved against the current container. */
export function toAbsoluteDownloadUri(relativePath: string): string {
	return `${documentsRoot()}${relativePath}`;
}

/**
 * Re-base a possibly stale absolute file URI inside a previous container's Documents directory onto the
 * current one. Non-file URIs (http/https) are returned unchanged.
 */
export function rebaseDocumentUri(uri: string): string {
	if (!uri.startsWith('file://')) return uri;
	const marker = '/Documents/';
	const idx = uri.indexOf(marker);
	if (idx === -1) return uri;
	return `${documentsRoot()}${uri.slice(idx + marker.length)}`;
}

/**
 * Ensure the download directory exists and is excluded from iCloud/iTunes backup. Re-downloadable media
 * must not be backed up (Apple storage guidelines); the attribute on the directory covers its contents.
 */
export async function prepareDownloadsDir(kind: DownloadKind): Promise<void> {
	const dir = downloadsDirUri(kind);
	try {
		await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
	} catch {
		// Already exists
	}
	if (isAvailable() && YhwavAudioModule?.excludeFromBackup) {
		try {
			await YhwavAudioModule.excludeFromBackup(dir);
		} catch (error) {
			console.warn(`Failed to exclude ${kind} downloads from backup:`, error);
		}
	}
}

/** Returns the subset of relative paths whose files no longer exist. */
export async function findMissingDownloads(relativePaths: string[]): Promise<Set<string>> {
	const missing = new Set<string>();
	await Promise.all(
		relativePaths.map(async (rel) => {
			try {
				const info = await FileSystem.getInfoAsync(toAbsoluteDownloadUri(rel));
				if (!info.exists) missing.add(rel);
			} catch {
				// Treat unreadable as present; never drop records on an I/O error.
			}
		}),
	);
	return missing;
}
