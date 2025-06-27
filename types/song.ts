export interface Song {
  id: string;
  title: string;
  artist?: string;
  uri: string;
  duration?: number;
  artwork?: string;
}