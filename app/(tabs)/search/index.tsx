import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Div } from '@/cmps/Div';
import { Main } from '@/cmps/Main';
import { ThemedText } from '@/cmps/ThemedText';
import { useAudio } from '@/ctx/AudioContext';
import { useSearchContext } from '@/ctx/SearchContext';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import type { Album, Artist, Song } from '@/types';

interface SearchResult {
	type: 'song' | 'album' | 'artist';
	item: Song | Album | Artist;
	score: number;
}

export default function SearchIndex() {
	const { query } = useSearchContext();
	const [searchResults, setSearchResults] = useState<{
		songs: SearchResult[];
		albums: SearchResult[];
		artists: SearchResult[];
	}>({
		songs: [],
		albums: [],
		artists: [],
	});
	const { tracks, albumsById, artistsByName } = useLibraryStore();
	const { playSound } = useAudio();
	const colorScheme = useColorScheme();
	// Debounce the query
	const [debouncedQuery, setDebouncedQuery] = useState('');

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, 300);

		return () => clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		if (!debouncedQuery.trim()) {
			setSearchResults({
				songs: [],
				albums: [],
				artists: [],
			});
			return;
		}

		const normalizedQuery = debouncedQuery.toLowerCase().trim();
		const results = {
			songs: [] as SearchResult[],
			albums: [] as SearchResult[],
			artists: [] as SearchResult[],
		};

		// Search songs
		for (const song of tracks.slice(0, 1000)) {
			const titleMatch = song.title.toLowerCase().includes(normalizedQuery);
			const artistMatch = song.artist.toLowerCase().includes(normalizedQuery);
			const albumMatch = song.album.toLowerCase().includes(normalizedQuery);

			if (titleMatch || artistMatch || albumMatch) {
				let score = 0;
				if (song.title.toLowerCase().startsWith(normalizedQuery)) score += 100;
				else if (song.title.toLowerCase().includes(normalizedQuery)) score += 50;
				if (song.artist.toLowerCase().startsWith(normalizedQuery)) score += 80;
				else if (song.artist.toLowerCase().includes(normalizedQuery)) score += 40;
				if (song.album.toLowerCase().startsWith(normalizedQuery)) score += 60;
				else if (song.album.toLowerCase().includes(normalizedQuery)) score += 30;

				results.songs.push({
					type: 'song',
					item: song,
					score,
				});
			}
		}

		// Search albums
		for (const album of Object.values(albumsById)) {
			const titleMatch = album.title.toLowerCase().includes(normalizedQuery);
			const artistMatch = album.artist.toLowerCase().includes(normalizedQuery);

			if (titleMatch || artistMatch) {
				let score = 0;
				if (album.title.toLowerCase().startsWith(normalizedQuery)) score += 100;
				else if (album.title.toLowerCase().includes(normalizedQuery)) score += 50;
				if (album.artist.toLowerCase().startsWith(normalizedQuery)) score += 80;
				else if (album.artist.toLowerCase().includes(normalizedQuery)) score += 40;

				results.albums.push({
					type: 'album',
					item: album,
					score,
				});
			}
		}

		// Search artists
		for (const artist of Object.values(artistsByName)) {
			const nameMatch = artist.name.toLowerCase().includes(normalizedQuery);

			if (nameMatch) {
				let score = 0;
				if (artist.name.toLowerCase().startsWith(normalizedQuery)) score += 100;
				else if (artist.name.toLowerCase().includes(normalizedQuery)) score += 50;

				results.artists.push({
					type: 'artist',
					item: artist,
					score,
				});
			}
		}

		// Sort by score and limit results
		results.songs.sort((a, b) => b.score - a.score);
		results.albums.sort((a, b) => b.score - a.score);
		results.artists.sort((a, b) => b.score - a.score);

		// Limit results per category
		results.songs = results.songs.slice(0, 20);
		results.albums = results.albums.slice(0, 10);
		results.artists = results.artists.slice(0, 10);

		setSearchResults(results);
	}, [debouncedQuery, tracks, albumsById, artistsByName]);

	const handleSongPress = async (song: Song) => {
		const formattedSong = {
			id: song.id,
			title: song.title || 'Unknown Title',
			artist: song.artist || 'Unknown Artist',
			artwork: song.artworkUrl || song.artwork || '',
			uri: song.uri || song.streamUrl || '',
		};
		await playSound(formattedSong);
	};

	const handleAlbumPress = (album: Album) => {
		router.push({
			// @ts-expect-error
			pathname: '(library)/(albums)/[albumId]',
			params: { albumId: encodeURIComponent(album.title) },
		});
	};

	const handleArtistPress = (artist: Artist) => {
		router.push(`/(tabs)/(library)/(artists)/${encodeURIComponent(artist.name)}`);
	};

	const totalResults = searchResults.songs.length + searchResults.albums.length + searchResults.artists.length;

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16, paddingBottom: 120 }}>
				{/* Artists Section */}
				{searchResults.artists.length > 0 && (
					<Div style={{ marginBottom: 24 }}>
						<ThemedText style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 12 }}>Artists</ThemedText>
						<FlatList
							scrollEnabled={false}
							data={searchResults.artists}
							keyExtractor={(_item, index) => `artist-${index}`}
							renderItem={({ item: _item }) => {
								const artist = _item.item as Artist;
								return (
									<Pressable
										onPress={() => handleArtistPress(artist)}
										style={{
											paddingVertical: 12,
											borderBottomWidth: StyleSheet.hairlineWidth,
											borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353',
										}}
									>
										<ThemedText style={{ fontSize: 16, fontWeight: 'bold' }}>{artist.name}</ThemedText>
										<ThemedText style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
											{artist.albumIds.length} albums
										</ThemedText>
									</Pressable>
								);
							}}
						/>
					</Div>
				)}

				{/* Albums Section */}
				{searchResults.albums.length > 0 && (
					<Div style={{ marginBottom: 24 }}>
						<ThemedText style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 12 }}>Albums</ThemedText>
						<FlatList
							scrollEnabled={false}
							data={searchResults.albums}
							keyExtractor={(_item, index) => `album-${index}`}
							renderItem={({ item: _item }) => {
								const album = _item.item as Album;
								return (
									<Pressable
										onPress={() => handleAlbumPress(album)}
										style={{
											paddingVertical: 12,
											borderBottomWidth: StyleSheet.hairlineWidth,
											borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353',
										}}
									>
										<ThemedText style={{ fontSize: 16, fontWeight: 'bold' }}>{album.title}</ThemedText>
										<ThemedText style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
											{album.artist} • {album.songIds.length} songs
										</ThemedText>
									</Pressable>
								);
							}}
						/>
					</Div>
				)}

				{/* Songs Section */}
				{searchResults.songs.length > 0 && (
					<Div style={{ marginBottom: 24 }}>
						<ThemedText style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 12 }}>Songs</ThemedText>
						<FlatList
							scrollEnabled={false}
							data={searchResults.songs}
							keyExtractor={(_item, index) => `song-${index}`}
							renderItem={({ item: _item }) => {
								const song = _item.item as Song;
								return (
									<Pressable
										onPress={() => handleSongPress(song)}
										style={{
											paddingVertical: 12,
											borderBottomWidth: StyleSheet.hairlineWidth,
											borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353',
										}}
									>
										<ThemedText style={{ fontSize: 16, fontWeight: 'bold' }}>{song.title}</ThemedText>
										<ThemedText style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
											{song.artist} • {song.album}
										</ThemedText>
									</Pressable>
								);
							}}
						/>
					</Div>
				)}

				{/* No Results */}
				{totalResults === 0 && debouncedQuery && (
					<Div style={{ padding: 20, alignItems: 'center' }}>
						<ThemedText style={{ fontSize: 16, color: '#666' }}>No results found for "{debouncedQuery}"</ThemedText>
					</Div>
				)}
			</Div>
		</Main>
	);
}
