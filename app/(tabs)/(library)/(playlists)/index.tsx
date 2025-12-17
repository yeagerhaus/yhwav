import { useMemo } from 'react';
import { ActivityIndicator, FlatList } from 'react-native';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { usePlaylists } from '@/hooks/usePlaylists';

export default function PlaylistsScreen() {
	const { playlists, isLoading } = usePlaylists();

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

	if (isLoading) {
		return (
			<Main>
				<Div style={{ paddingHorizontal: 16, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
					<ActivityIndicator />
				</Div>
			</Main>
		);
	}

	if (formattedPlaylists.length === 0) {
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
		<Main>
			<Div style={{ paddingHorizontal: 16 }}>
				<Div>
					<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16 }}>Playlists</ThemedText>
				</Div>
				<FlatList
					scrollEnabled={false}
					data={formattedPlaylists}
					keyExtractor={(item) => item.id.toString()}
					numColumns={2}
					contentContainerStyle={{ paddingBottom: 80 }}
					columnWrapperStyle={{ justifyContent: 'space-between' }}
					renderItem={({ item }) => <DynamicItem item={item} type='playlist' />}
				/>
			</Div>
		</Main>
	);
}
