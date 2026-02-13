import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image } from 'react-native';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { usePlaylists } from '@/hooks/usePlaylists';
import type { Playlist } from '@/types/playlist';
import type { Song } from '@/types/song';

const ITEM_HEIGHT = 70;

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
	}, [playlistId, playlists, loadPlaylistTracks]);

	const keyExtractor = useCallback((item: Song) => item.id, []);
	const renderItem = useCallback(({ item }: { item: Song }) => <DynamicItem item={item} type='song' queue={songs} />, [songs]);
	const getItemLayout = useCallback(
		(_: any, index: number) => ({
			length: ITEM_HEIGHT,
			offset: ITEM_HEIGHT * index,
			index,
		}),
		[],
	);

	const listHeaderComponent = useMemo(
		() => (
			<Div style={{ alignItems: 'center', paddingTop: 64 }}>
				{artwork && (
					<Image source={{ uri: artwork }} style={{ width: '100%', maxHeight: 250, aspectRatio: 1 }} resizeMode='contain' />
				)}
				<Div style={{ paddingVertical: 16, alignItems: 'flex-start', width: '100%' }}>
					{playlist && (
						<Div style={{ marginBottom: 16 }}>
							<ThemedText style={{ fontSize: 24, fontWeight: 'bold' }}>{playlist.title}</ThemedText>
							<ThemedText style={{ fontSize: 16, color: '#888' }}>
								{playlist.summary || `${playlist.leafCount || 0} tracks`}
							</ThemedText>
						</Div>
					)}
				</Div>
			</Div>
		),
		[artwork, playlist],
	);

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={songs}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				getItemLayout={getItemLayout}
				ListHeaderComponent={listHeaderComponent}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={15}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}
