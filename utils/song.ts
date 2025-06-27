import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { parseBuffer } from 'music-metadata-browser';
import { Song } from '@/types/song';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_QUEUE_KEY, STORAGE_SONG_KEY, STORAGE_POSITION_KEY } from '@/ctx/AudioContext';
import { NativeModules } from 'react-native';

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

export const getMetadataFromUri = async (uri: string): Promise<Partial<Song>> => {
	try {
		const fileInfo = await FileSystem.readAsStringAsync(uri, {
		encoding: FileSystem.EncodingType.Base64,
		});

		const binary = Uint8Array.from(atob(fileInfo), (c) => c.charCodeAt(0));
		const metadata = await parseBuffer(binary, uri.split('.').pop() || '', { duration: true });

		const { common, format } = metadata;

		let artworkUri: string | undefined;
		if (common.picture?.[0]) {
		const base64Image = uint8ToBase64(common.picture[0].data);
		artworkUri = `data:${common.picture[0].format};base64,${base64Image}`;
		}

		return {
		title: common.title ?? '',
		artist: common.artist ?? '',
		album: common.album ?? '',
		artwork: artworkUri,
		duration: format.duration,
		};
	} catch (err) {
		console.warn('Failed to read metadata from', uri, err);
		return {};
	}
};

export const loadTracksFromDirectory = async () => {
	try {
	const dirUri = `${FileSystem.documentDirectory}songs/`;
	await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });

	const files = await FileSystem.readDirectoryAsync(dirUri);
	const audioFiles = files.filter((f) => f.endsWith('.m4a') || f.endsWith('.mp3'));

	const localSongs: Song[] = await Promise.all(
		audioFiles.map(async (filename, index) => {
		const artworkPath = `${FileSystem.documentDirectory}artwork/${filename}.png`;
		const artworkExists = await FileSystem.getInfoAsync(artworkPath);
		const artworkUri = artworkExists.exists
			? artworkPath
			: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Speaker_Icon.svg';

		return {
			id: filename,
			title: filename.replace(/\.[^/.]+$/, ''),
			artist: 'Unknown Artist',
			artwork: artworkUri,
			uri: dirUri + filename,
		};
		})
	);

	return localSongs;
	} catch (err) {
	console.error('Error loading songs from local directory:', err);
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
			artwork: artworkUri,
			uri: destination,
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
	await AsyncStorage.multiRemove([
		STORAGE_QUEUE_KEY,
		STORAGE_SONG_KEY,
		STORAGE_POSITION_KEY,
	]);

	console.log('All local songs deleted.');
	return
	} catch (err) {
	console.error('Failed to delete songs:', err);
	}
};