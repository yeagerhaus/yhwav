import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { usePlaylists } from '@/hooks/usePlaylists';
import { createPlaylist } from '@/utils/plex';

export default function PlaylistsScreen() {
	const { playlists, isLoading } = usePlaylists();
	const setPlaylists = useLibraryStore((s) => s.setPlaylists);
	const hasNoPlaylists = useMemo(() => !playlists.length, [playlists]);

	const formattedPlaylists = useMemo(
		() =>
			playlists
				.filter((playlist) => playlist.playlistType === 'audio' && playlist.artworkUrl != null)
				.map((playlist) => ({
					id: playlist.key || playlist.id,
					title: playlist.title,
					subtitle: playlist.summary || `${playlist.leafCount || 0} tracks`,
					artwork: playlist.artworkUrl || playlist.artwork || '',
					count: playlist.leafCount || 0,
					duration: playlist.duration || 0,
				}))
				.sort((a, b) => a.title.localeCompare(b.title)),
		[playlists],
	);

	const handleCreatePlaylist = useCallback(() => {
		if (Platform.OS === 'ios') {
			Alert.prompt('New Playlist', 'Enter a name for your playlist', async (name) => {
				if (!name?.trim()) return;
				const newPlaylist = await createPlaylist(name.trim());
				if (newPlaylist) {
					setPlaylists([...playlists, newPlaylist]);
					router.push({
						// @ts-expect-error
						pathname: '(library)/(playlists)/[playlistId]',
						params: { playlistId: newPlaylist.key },
					});
				}
			});
		} else {
			Alert.alert('New Playlist', 'Enter a name for your playlist');
		}
	}, [playlists, setPlaylists]);

	const keyExtractor = useCallback((item: (typeof formattedPlaylists)[0]) => item.id.toString(), [formattedPlaylists]);

	const renderItem = useCallback(({ item }: { item: (typeof formattedPlaylists)[0] }) => <DynamicItem item={item} type='playlist' />, []);

	const listHeaderComponent = useMemo(
		() => (
			<Div transparent style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 64, marginBottom: 16 }}>
				<Text type='h1'>Playlists</Text>
				<Pressable onPress={handleCreatePlaylist} hitSlop={8}>
					<Ionicons name='add-circle-outline' size={28} color='#7f62f5' />
				</Pressable>
			</Div>
		),
		[handleCreatePlaylist],
	);

	if (isLoading) {
		return (
			<Main>
				<Div transparent style={{ paddingHorizontal: 16, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
					<ActivityIndicator />
				</Div>
			</Main>
		);
	}

	if (hasNoPlaylists) {
		return (
			<Main>
				<Div transparent style={{ paddingHorizontal: 16, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
					<Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>Playlists</Text>
					<Text type="body" colorVariant="muted">No playlists found</Text>
					<Pressable onPress={handleCreatePlaylist} style={{ marginTop: 16 }}>
						<Text type="body" colorVariant="brand">Create Playlist</Text>
					</Pressable>
				</Div>
			</Main>
		);
	}

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={formattedPlaylists}
				keyExtractor={keyExtractor}
				numColumns={2}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={10}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
				columnWrapperStyle={{ justifyContent: 'space-between' }}
			/>
		</Main>
	);
}
