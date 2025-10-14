import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image } from 'react-native';
import { DynamicItem, ThemedText } from '@/cmps';
import { Div } from '@/cmps/Div';
import { Main } from '@/cmps/Main';
import { usePlaylists } from '@/hooks/usePlaylists';
import type { Playlist } from '@/types/playlist';
import type { Song } from '@/types/song';

export default function DetailScreen() {
	const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
	const { playlists, loadPlaylistTracks } = usePlaylists();
	const [songs, setSongs] = useState<Song[]>([]);
	const [playlist, setPlaylist] = useState<Playlist | null>(null);
	const [artwork, setArtwork] = useState<string | null>(null);

	useEffect(() => {
		if (!playlistId) return;

		const loadPlaylistData = async () => {
			// Find the playlist in the store by key or id
			const foundPlaylist = playlists.find((p) => p.key === playlistId || p.id === playlistId);
			if (foundPlaylist) {
				setPlaylist(foundPlaylist);
				if (foundPlaylist.artworkUrl) {
					setArtwork(foundPlaylist.artworkUrl);
				}
			}

			// Load playlist tracks using the playlist ID directly
			const tracks = await loadPlaylistTracks(playlistId);
			if (tracks && tracks.length > 0) {
				// Sort tracks by playlist index (order from Plex) if available, otherwise maintain order
				const sorted = tracks.sort((a, b) => {
					const playlistIndexDiff = (a.playlistIndex ?? 0) - (b.playlistIndex ?? 0);
					if (playlistIndexDiff !== 0) return playlistIndexDiff;
					// Fallback to track number if playlistIndex is not available
					const trackDiff = (a.trackNumber ?? 0) - (b.trackNumber ?? 0);
					if (trackDiff !== 0) return trackDiff;
					return (a.discNumber ?? 0) - (b.discNumber ?? 0);
				});
				setSongs(sorted);
			}
		};

		loadPlaylistData();
	}, [playlistId, playlists]);

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16 }}>
				{artwork && (
					<Image source={{ uri: artwork }} style={{ width: '100%', height: '100%', maxHeight: 250 }} resizeMode='contain' />
				)}
				<Div style={{ paddingVertical: 16 }}>
					{playlist && (
						<Div style={{ marginBottom: 16 }}>
							<ThemedText style={{ fontSize: 24, fontWeight: 'bold' }}>{playlist.title}</ThemedText>
							<ThemedText style={{ fontSize: 16, color: '#888' }}>
								{playlist.summary || `${playlist.leafCount || 0} tracks`}
							</ThemedText>
						</Div>
					)}
					<FlatList
						scrollEnabled={false}
						data={songs}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => <DynamicItem item={item} type='song' queue={songs} />}
						contentContainerStyle={{ paddingBottom: 300 }}
					/>
				</Div>
			</Div>
		</Main>
	);
}
