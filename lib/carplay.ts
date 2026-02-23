import { Platform } from 'react-native';
import { CarPlay, ListTemplate, TabBarTemplate } from 'react-native-carplay';
import type { ListItem } from 'react-native-carplay/lib/interfaces/ListItem';
import { useAudioStore } from '@/hooks/useAudioStore';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import type { Playlist, Song } from '@/types';
import { fetchPlaylistTracks } from '@/utils/plex';

let recentlyPlayedList: ListTemplate | null = null;
let playlistsList: ListTemplate | null = null;
let storeUnsubscribers: (() => void)[] = [];

function songToListItem(song: Song): ListItem {
	return {
		text: song.title,
		detailText: song.artist,
		imgUrl: null,
	};
}

function playlistToListItem(playlist: Playlist): ListItem {
	return {
		text: playlist.title,
		detailText: playlist.leafCount ? `${playlist.leafCount} tracks` : undefined,
		showsDisclosureIndicator: true,
		imgUrl: null,
	};
}

function buildRecentlyPlayedTemplate(songs: Song[]): ListTemplate {
	const template = new ListTemplate({
		id: 'carplay-recently-played',
		title: 'Recently Played',
		tabTitle: 'Recent',
		tabSystemImageName: 'clock',
		sections: [{ items: songs.map(songToListItem) }],
		emptyViewTitleVariants: ['No Recently Played'],
		emptyViewSubtitleVariants: ['Play some music to see it here'],
		async onItemSelect({ index }) {
			const { recentlyPlayed } = useLibraryStore.getState();
			const song = recentlyPlayed[index];
			if (song) {
				useAudioStore.getState().playSound(song, recentlyPlayed);
			}
		},
	});
	return template;
}

function buildPlaylistsTemplate(playlists: Playlist[]): ListTemplate {
	const template = new ListTemplate({
		id: 'carplay-playlists',
		title: 'Playlists',
		tabTitle: 'Playlists',
		tabSystemImageName: 'music.note.list',
		sections: [{ items: playlists.map(playlistToListItem) }],
		emptyViewTitleVariants: ['No Playlists'],
		emptyViewSubtitleVariants: ['Create playlists in your Plex library'],
		async onItemSelect({ index }) {
			const { playlists: currentPlaylists } = useLibraryStore.getState();
			const playlist = currentPlaylists[index];
			if (!playlist) return;

			const tracks = await fetchPlaylistTracks(playlist.key);
			const detailTemplate = new ListTemplate({
				title: playlist.title,
				sections: [{ items: tracks.map(songToListItem) }],
				emptyViewTitleVariants: ['Empty Playlist'],
				async onItemSelect({ index: trackIndex }) {
					const song = tracks[trackIndex];
					if (song) {
						useAudioStore.getState().playSound(song, tracks);
					}
				},
			});

			CarPlay.pushTemplate(detailTemplate, true);
		},
	});
	return template;
}

function onConnect() {
	const { recentlyPlayed, playlists } = useLibraryStore.getState();

	recentlyPlayedList = buildRecentlyPlayedTemplate(recentlyPlayed);
	playlistsList = buildPlaylistsTemplate(playlists);

	const tabBar = new TabBarTemplate({
		title: 'yhwav',
		templates: [recentlyPlayedList, playlistsList],
		onTemplateSelect() {},
	});

	CarPlay.setRootTemplate(tabBar, false);
	CarPlay.enableNowPlaying(true);

	// Keep CarPlay lists in sync with store changes
	const unsubRecent = useLibraryStore.subscribe((state, prev) => {
		if (state.recentlyPlayed !== prev.recentlyPlayed) {
			recentlyPlayedList?.updateSections([{ items: state.recentlyPlayed.map(songToListItem) }]);
		}
	});

	const unsubPlaylists = useLibraryStore.subscribe((state, prev) => {
		if (state.playlists !== prev.playlists) {
			playlistsList?.updateSections([{ items: state.playlists.map(playlistToListItem) }]);
		}
	});

	storeUnsubscribers.push(unsubRecent, unsubPlaylists);
}

function onDisconnect() {
	for (const unsub of storeUnsubscribers) unsub();
	storeUnsubscribers = [];
	recentlyPlayedList = null;
	playlistsList = null;
}

export function setupCarPlay() {
	if (Platform.OS !== 'ios') return;
	CarPlay.registerOnConnect(onConnect);
	CarPlay.registerOnDisconnect(onDisconnect);
}

export function teardownCarPlay() {
	if (Platform.OS !== 'ios') return;
	CarPlay.unregisterOnConnect(onConnect);
	CarPlay.unregisterOnDisconnect(onDisconnect);
	onDisconnect();
}
