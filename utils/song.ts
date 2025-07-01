import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Song } from '@/types/song';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_QUEUE_KEY, STORAGE_SONG_KEY, STORAGE_POSITION_KEY } from '@/ctx/AudioContext';
import { NativeModules } from 'react-native';
import { clearCachedTracks } from './cache';
import { useLibraryStore } from '@/hooks/useLibraryStore';

const { MetadataModule } = NativeModules;

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

function uint8ToBase64(uint8: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < uint8.length; i++) {
		binary += String.fromCharCode(uint8[i]);
	}
	return btoa(binary);
}

export const loadTracksFromDirectory = async (): Promise<Song[]> => {
  try {
    const dirUri = `${FileSystem.documentDirectory}songs/`;
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });

    const files = await FileSystem.readDirectoryAsync(dirUri);
    const audioFiles = files.filter((f) => f.endsWith('.m4a') || f.endsWith('.mp3'));

    const songs: Song[] = await Promise.all(
      audioFiles.map(async (filename, index) => {
        const fullUri = dirUri + filename;

        const metadata = await getMetadataFromNative(fullUri);

        const artworkPath = `${FileSystem.documentDirectory}artwork/${filename}.png`;
        const artworkExists = await FileSystem.getInfoAsync(artworkPath);
        const artworkUri = artworkExists.exists
          ? artworkPath
          : 'path/to/your/local/fallback.png'; // Replace with a bundled fallback asset if needed

        return {
          id: filename, // Or hash or uuid if you prefer
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          artwork: artworkUri,
          uri: fullUri,
          duration: metadata.duration,
		  trackNumber: metadata.trackNumber || index + 1, // Use index as fallback track number
		  discNumber: metadata.discNumber || 1, // Default to 1 if not provided
        };
      })
    );

    return songs;
  } catch (err) {
    console.error('Error loading songs from local directory:', err);
    return [];
  }
};

export const pickAndImportSongs = async (): Promise<Song[]> => {
	try {
	const result = await DocumentPicker.getDocumentAsync({
		type: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'],
		multiple: true,
		copyToCacheDirectory: false,
	});

	if (result.assets?.length) {
		const dir = `${FileSystem.documentDirectory}songs/`;
		await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

		const importedSongs: Song[] = [];

		for (const [index, file] of result.assets.entries()) {
		const filename = file.name;
		const destination = dir + filename;

		await FileSystem.copyAsync({ from: file.uri, to: destination });
		const metadata = await getMetadataFromNative(destination);

		let artworkUri = 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Speaker_Icon.svg';
		if (metadata.artwork) {
			const artworkBase64 = metadata.artwork.replace(/^data:image\/\w+;base64,/, '');
			const artworkPath = `${FileSystem.documentDirectory}artwork/${filename}.png`;
			await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}artwork/`, { intermediates: true });
			await FileSystem.writeAsStringAsync(artworkPath, artworkBase64, { encoding: FileSystem.EncodingType.Base64 });
			artworkUri = artworkPath;
		}

		importedSongs.push({
			id: (Date.now() + index).toString(),
			title: metadata.title || filename.replace(/\.[^/.]+$/, ''),
			artist: metadata.artist || 'Unknown Artist',
			album: metadata.album || 'Unknown Album',
			artwork: artworkUri,
			uri: destination,
			duration: metadata.duration || 0,
			trackNumber: metadata.trackNumber || index + 1, // Use index as fallback track number
			discNumber: metadata.discNumber || 1,
		});
		}

		return importedSongs;
	}

	return [];
	} catch (err) {
	console.error('Failed to import songs:', err);
	return [];
	}
};

export const deleteAllSongs = async () => {
	try {
		const dirUri = `${FileSystem.documentDirectory}songs/`;
		const files = await FileSystem.readDirectoryAsync(dirUri);

		for (const file of files) {
		await FileSystem.deleteAsync(dirUri + file, { idempotent: true });
		}

		await FileSystem.deleteAsync(`${FileSystem.documentDirectory}artwork/`, { idempotent: true });

		// Clear audio playback state
		await AsyncStorage.multiRemove([
			STORAGE_QUEUE_KEY,
			STORAGE_SONG_KEY,
			STORAGE_POSITION_KEY,
			'ARTIST_INFO_CACHE',
		]);

		// Clear track cache
		await clearCachedTracks();

		// Optional: if you're inside a component, clear Zustand store too:
		useLibraryStore.getState().setTracks([]);

		console.log('All local songs deleted.');
	} catch (err) {
		console.error('Failed to delete songs:', err);
	}
};
