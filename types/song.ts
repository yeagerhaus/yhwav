export interface Song {
  id: string;
  title: string;
  artist: string;
  artistKey: string; 
  album: string;
  artwork: string;
  uri: string;
  streamUrl?: string; // Optional for streaming tracks
  artworkUrl?: string; // Optional for Plex tracks
  duration: number;
  trackNumber: number;
  discNumber: number;
}