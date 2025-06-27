export interface Song {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  uri: string;
  duration?: number;
  artwork?: string;
}