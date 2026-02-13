import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList } from 'react-native';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { usePlaylists } from '@/hooks/usePlaylists';

export default function PlaylistsScreen() {
	const { playlists, isLoading } = usePlaylists();
	const hasNoPlaylists = useMemo(() => !playlists.length, [playlists]);

	const formattedPlaylists = useMemo(
		() =>
			playlists
				.filter((playlist) => playlist.playlistType === 'audio') // Only show audio playlists
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

	const keyExtractor = useCallback((item: (typeof formattedPlaylists)[0]) => item.id.toString(), [formattedPlaylists]);

	const renderItem = useCallback(({ item }: { item: (typeof formattedPlaylists)[0] }) => <DynamicItem item={item} type='playlist' />, []);

	const listHeaderComponent = useMemo(
		() => (
			<Div>
				<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16, paddingTop: 64 }}>Playlists</ThemedText>
			</Div>
		),
		[],
	);

	if (isLoading) {
		return (
			<Main>
				<Div style={{ paddingHorizontal: 16, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
					<ActivityIndicator />
				</Div>
			</Main>
		);
	}

	if (hasNoPlaylists) {
		return (
			<Main>
				<Div style={{ paddingHorizontal: 16, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
					<ThemedText style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>Playlists</ThemedText>
					<ThemedText style={{ fontSize: 16, color: '#888' }}>No playlists found</ThemedText>
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
				contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
				columnWrapperStyle={{ justifyContent: 'space-between' }}
			/>
		</Main>
	);
}
