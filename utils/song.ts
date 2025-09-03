import { NativeModules } from 'react-native';

const { MetadataModule } = NativeModules;

export function normalizeArtist(str: string) {
	return str?.split(';')[0].trim().toLowerCase() || 'unknown artist';
}

export async function getMetadataFromNative(uri: string) {
	try {
		const meta = await MetadataModule.getMetadata(uri.replace('file://', ''));

		return {
			title: meta.title || '',
			artist: meta.artist || '',
			album: meta.albumName || '',
			duration: meta.duration || 0,
			artwork: meta.artwork || '', // optional: handle binary art later
			trackNumber: meta.trackNumber || 0,
			discNumber: meta.discNumber || 1, // default to 1 if not provided
		};
	} catch (err) {
		console.warn('Failed to read metadata:', err);
		return {};
	}
}
