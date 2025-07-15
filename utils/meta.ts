import * as FileSystem from 'expo-file-system';
import { Song } from '@/types/song'; // or define the Song interface here

const SONGS_JSON_PATH = `${FileSystem.documentDirectory}songs/songs.json`;

export async function saveSongsMetadata(songs: Song[]) {
  await FileSystem.writeAsStringAsync(SONGS_JSON_PATH, JSON.stringify(songs), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function loadSongsMetadata(): Promise<Song[]> {
  try {
    const json = await FileSystem.readAsStringAsync(SONGS_JSON_PATH);
    return JSON.parse(json);
  } catch {
    return []; // fallback if file not found or unreadable
  }
}