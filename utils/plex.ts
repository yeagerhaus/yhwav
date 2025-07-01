import { Song } from '@/types/song';

const PLEX_SERVER = process.env.PLEX_SERVER!;
const PLEX_TOKEN = process.env.PLEX_TOKEN!;
const PLEX_MUSIC_SECTION_ID = process.env.PLEX_MUSIC_SECTION_ID || '6';

export async function fetchPlexMusic(): Promise<Song[]> {
  try {
    // Get all tracks in the music library section
    const url = `${PLEX_SERVER}/library/sections/${PLEX_MUSIC_SECTION_ID}/all?type=10&X-Plex-Token=${PLEX_TOKEN}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch Plex music:', response.statusText);
      return [];
    }

    const json = await response.json();

    if (!json.MediaContainer?.Metadata) {
      console.warn('No music metadata found in response.');
      return [];
    }

    return json.MediaContainer.Metadata.map((track: any): Song => {
      const media = track?.Media?.[0];
      const part = media?.Part?.[0];

      return {
        id: track.ratingKey,
        title: track.title,
        artist: track.originalTitle || track.grandparentTitle || 'Unknown Artist',
        album: track.parentTitle || 'Unknown Album',
        artwork: `${PLEX_SERVER}${track.thumb}?X-Plex-Token=${PLEX_TOKEN}`,
        uri: `${PLEX_SERVER}${part?.key}?X-Plex-Token=${PLEX_TOKEN}`,
      };
    });
  } catch (err) {
    console.error('Error fetching music from Plex:', err);
    return [];
  }
}
