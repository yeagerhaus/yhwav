import * as FileSystem from 'expo-file-system';
import { parseBuffer } from 'music-metadata-browser';
import { Song } from '@/types/song';

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
      artwork: artworkUri,
      duration: format.duration,
    };
  } catch (err) {
    console.warn('Failed to read metadata from', uri, err);
    return {};
  }
};
