import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAddToPlaylist } from '@/hooks/useAddToPlaylist';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { addToPlaylist, createPlaylist } from '@/utils/plex';
import { Div } from './Div';
import { Text } from './Text';

const ANIM_DURATION = 250;

export function AddToPlaylistModal() {
	const { visible, label, ratingKeys, close } = useAddToPlaylist();
	const playlists = useLibraryStore((s) => s.playlists);
	const setPlaylists = useLibraryStore((s) => s.setPlaylists);

	const audioPlaylists = playlists.filter((p) => p.playlistType === 'audio' && !p.smart);

	// Animation: backdrop opacity + sheet translate
	const opacity = useSharedValue(0);
	const translateY = useSharedValue(400);
	const mounted = useSharedValue(false);

	useEffect(() => {
		if (visible) {
			mounted.value = true;
			opacity.value = withTiming(1, { duration: ANIM_DURATION });
			translateY.value = withTiming(0, { duration: ANIM_DURATION });
		} else {
			opacity.value = withTiming(0, { duration: ANIM_DURATION });
			translateY.value = withTiming(400, { duration: ANIM_DURATION }, () => {
				mounted.value = false;
			});
		}
	}, [visible, opacity, translateY, mounted]);

	const backdropStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		// Only intercept touches when visible
		pointerEvents: mounted.value ? ('auto' as const) : ('none' as const),
	}));

	const sheetStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
	}));

	const animatedClose = useCallback(() => {
		// Animate out, then reset store
		opacity.value = withTiming(0, { duration: ANIM_DURATION });
		translateY.value = withTiming(400, { duration: ANIM_DURATION }, () => {
			mounted.value = false;
			runOnJS(close)();
		});
	}, [close, opacity, translateY, mounted]);

	const handleSelect = useCallback(
		async (playlistRatingKey: string) => {
			if (!ratingKeys.length) return;
			animatedClose();
			try {
				await addToPlaylist(playlistRatingKey, ratingKeys);
			} catch (err) {
				console.error('Failed to add to playlist:', err);
			}
		},
		[ratingKeys, animatedClose],
	);

	const handleNewPlaylist = useCallback(() => {
		if (!ratingKeys.length) return;
		const keys = [...ratingKeys];
		Alert.prompt('New Playlist', 'Enter a name for your playlist', async (name) => {
			if (!name?.trim()) return;
			animatedClose();
			try {
				const newPlaylist = await createPlaylist(name.trim(), keys);
				if (newPlaylist) {
					setPlaylists([...playlists, newPlaylist]);
				}
			} catch (err) {
				console.error('Failed to create playlist:', err);
			}
		});
	}, [ratingKeys, animatedClose, playlists, setPlaylists]);

	return (
		<Animated.View style={[styles.backdrop, backdropStyle]}>
			<Pressable style={styles.backdropTouch} onPress={animatedClose} />
			<Animated.View style={[styles.sheet, sheetStyle]}>
				<Div style={styles.handle} />
				<Text style={styles.title}>Add to Playlist</Text>
				{label ? (
					<Text style={styles.songName} numberOfLines={1}>
						{label}
					</Text>
				) : null}

				<Pressable style={styles.newPlaylistRow} onPress={handleNewPlaylist}>
					<Ionicons name='add-circle' size={28} color='#7f62f5' />
					<Text style={styles.newPlaylistText}>New Playlist...</Text>
				</Pressable>

				<FlatList
					data={audioPlaylists}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<Pressable style={styles.row} onPress={() => handleSelect(item.ratingKey)}>
							<SymbolView name='music.note.list' size={22} tintColor='#aaa' />
							<Text style={styles.playlistName} numberOfLines={1}>
								{item.title}
							</Text>
							<Text style={styles.trackCount}>{item.leafCount ?? 0}</Text>
						</Pressable>
					)}
					style={styles.list}
				/>
			</Animated.View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFillObject,
		zIndex: 9999,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'flex-end',
	},
	backdropTouch: {
		flex: 1,
	},
	sheet: {
		backgroundColor: '#1c1c1e',
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingBottom: 40,
		maxHeight: '70%',
	},
	handle: {
		width: 36,
		height: 5,
		borderRadius: 3,
		backgroundColor: '#666',
		alignSelf: 'center',
		marginTop: 8,
		marginBottom: 12,
	},
	title: {
		fontSize: 18,
		fontWeight: '700',
		textAlign: 'center',
		marginBottom: 4,
	},
	songName: {
		fontSize: 13,
		color: '#888',
		textAlign: 'center',
		marginBottom: 16,
		paddingHorizontal: 24,
	},
	newPlaylistRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: 'rgba(255,255,255,0.1)',
	},
	newPlaylistText: {
		fontSize: 16,
		color: '#7f62f5',
		fontWeight: '600',
	},
	list: {
		paddingHorizontal: 20,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: 'rgba(255,255,255,0.06)',
	},
	playlistName: {
		flex: 1,
		fontSize: 16,
		color: '#fff',
	},
	trackCount: {
		fontSize: 14,
		color: '#666',
	},
});
