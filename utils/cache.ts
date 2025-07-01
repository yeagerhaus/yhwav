import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song } from '@/types/song';
import { loadTracksFromDirectory } from './song';

const STORAGE_TRACKS_KEY = 'ALL_TRACKS';

export async function saveCachedTracks(tracks: Song[]) {
  try {
    await AsyncStorage.setItem(STORAGE_TRACKS_KEY, JSON.stringify(tracks));
  } catch (err) {
    console.error('Failed to save tracks to cache:', err);
  }
}

export async function loadCachedTracks(): Promise<Song[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_TRACKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load cached tracks:', err);
    return [];
  }
}

export async function loadCachedOrScanSongs(): Promise<Song[]> {
  let tracks = await loadCachedTracks();

  if (!tracks || tracks.length === 0) {
    console.log('No cached tracks found, scanning directory...');
    tracks = await loadTracksFromDirectory();
    if (tracks && tracks.length) {
      await saveCachedTracks(tracks);
    }
  } else {
    console.log(`Loaded ${tracks.length} tracks from cache`);
  }

  return tracks;
}

export async function clearCachedTracks() {
  try {
    await AsyncStorage.removeItem(STORAGE_TRACKS_KEY);
  } catch (err) {
    console.error('Failed to clear cached tracks:', err);
  }
}
