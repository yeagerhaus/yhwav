import * as FileSystem from 'expo-file-system';
import type { Song } from '@/types/song';

export const downloadTrack = async (track: Song): Promise<string | null> => {
	try {
		const filename = `${track.id}.mp3`; // or parse extension from streamUrl
		const path = `${FileSystem.documentDirectory}downloads/${filename}`;

		await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}downloads/`, {
			intermediates: true,
		});

		const res = await FileSystem.downloadAsync(track.streamUrl!, path);
		console.log(`Downloaded: ${res.uri}`);

		return res.uri;
	} catch (err) {
		console.error(`Failed to download track ${track.title}:`, err);
		return null;
	}
};
