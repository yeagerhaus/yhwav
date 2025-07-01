// utils/artistInfo.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

type CachedArtistInfo = {
  name: string;
  genre?: string;
  image?: string;
  link?: string;
};

const ARTIST_CACHE_KEY = 'ARTIST_INFO_CACHE';

export async function getArtistInfo(name: string): Promise<CachedArtistInfo | null> {
  const key = `${ARTIST_CACHE_KEY}:${name.toLowerCase()}`;

  const cached = await AsyncStorage.getItem(key);
  if (cached) return JSON.parse(cached);

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`
    );
    const json = await res.json();

    if (json.resultCount === 0) return null;

    const artist = json.results[0];
    const artistInfo: CachedArtistInfo = {
      name: artist.artistName,
      genre: artist.primaryGenreName,
      link: artist.artistLinkUrl,
    };

    // Fallback image using another iTunes query to pull an album cover
    const albumRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=album&limit=1`
    );
    const albumJson = await albumRes.json();
    if (albumJson.resultCount > 0) {
      artistInfo.image = albumJson.results[0].artworkUrl100.replace('100x100bb', '300x300bb');
    }

    await AsyncStorage.setItem(key, JSON.stringify(artistInfo));
    return artistInfo;
  } catch (err) {
    console.error('Failed to fetch artist info:', err);
    return null;
  }
}
