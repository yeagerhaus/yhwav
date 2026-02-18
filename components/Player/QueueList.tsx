import React, { useCallback, useMemo, useRef } from 'react';
import { Image, type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import DraggableFlatList, { type RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { useAudioStore } from '@/hooks/useAudioStore';
import type { Song } from '@/types/song';
import { Div } from '../Div';
import { Text } from '../Text';
import { SymbolView } from 'expo-symbols';

interface QueueListProps {
	headerComponent: React.ReactElement;
}

export const QueueList = React.memo(({ headerComponent }: QueueListProps) => {
	const listRef = useRef<any>(null);
	const playerHeight = useRef(0);
	const hasScrolled = useRef(false);

	const handlePlayerLayout = useCallback((e: LayoutChangeEvent) => {
		playerHeight.current = e.nativeEvent.layout.height;
		if (!hasScrolled.current && listRef.current) {
			hasScrolled.current = true;
			setTimeout(() => {
				listRef.current?.scrollToOffset({ offset: playerHeight.current, animated: true });
			}, 100);
		}
	}, []);

	const queue = useAudioStore((s) => s.queue);
	const currentSong = useAudioStore((s) => s.currentSong);
	const removeFromQueue = useAudioStore((s) => s.removeFromQueue);
	const clearQueue = useAudioStore((s) => s.clearQueue);
	const reorderQueue = useAudioStore((s) => s.reorderQueue);
	const playSound = useAudioStore((s) => s.playSound);

	const currentIndex = useMemo(() => (currentSong ? queue.findIndex((s) => s.id === currentSong.id) : -1), [queue, currentSong]);

	const nextUpSongs = useMemo(() => (currentIndex >= 0 ? queue.slice(currentIndex + 1) : []), [queue, currentIndex]);

	const handleRemove = useCallback(
		(localIndex: number) => {
			removeFromQueue(currentIndex + 1 + localIndex);
		},
		[removeFromQueue, currentIndex],
	);

	const handleReorder = useCallback(
		({ data: _data, from, to }: { data: Song[]; from: number; to: number }) => {
			const globalFrom = currentIndex + 1 + from;
			const globalTo = currentIndex + 1 + to;
			reorderQueue(globalFrom, globalTo);
		},
		[reorderQueue, currentIndex],
	);

	const handlePlaySong = useCallback(
		(song: Song) => {
			playSound(song, queue);
		},
		[playSound, queue],
	);

	const keyExtractor = useCallback((item: Song, index: number) => `${item.id}-${index}`, []);

	const renderItem = useCallback(
		({ item, drag, isActive, getIndex }: RenderItemParams<Song>) => (
			<ScaleDecorator>
				<Pressable
					onPress={() => handlePlaySong(item)}
					onLongPress={drag}
					disabled={isActive}
					style={[styles.row, isActive && styles.rowActive]}
				>
					<Pressable
						onPress={() => {
							const idx = getIndex();
							if (idx !== undefined) handleRemove(idx);
						}}
						hitSlop={8}
						style={styles.removeButton}
					>
						<SymbolView name='minus.circle' size={22} tintColor='rgba(255, 255, 255, 0.6)' />
					</Pressable>
					<Image source={{ uri: item.artworkUrl || item.artwork }} style={styles.artwork} />
					<Div transparent style={styles.songInfo}>
						<Text numberOfLines={1} style={styles.title}>
							{item.title}
						</Text>
						<Text numberOfLines={1} style={styles.artist}>
							{item.artist}
						</Text>
					</Div>
					<Pressable onLongPress={drag} hitSlop={8} style={styles.dragHandle}>
						<SymbolView name='text.justify' size={24} tintColor='rgba(255, 255, 255, 0.5)' />
					</Pressable>
				</Pressable>
			</ScaleDecorator>
		),
		[handlePlaySong, handleRemove],
	);

	const listHeader = useMemo(
		() => (
			<View>
				<View onLayout={handlePlayerLayout}>{headerComponent}</View>

				{/* Now Playing */}
				{currentSong && (
					<View style={styles.section}>
						<Text style={styles.sectionHeader}>NOW PLAYING</Text>
						<View style={styles.nowPlayingRow}>
							<Image source={{ uri: currentSong.artworkUrl || currentSong.artwork }} style={styles.artwork} />
							<Div transparent style={styles.songInfo}>
								<Text numberOfLines={1} style={styles.title}>
									{currentSong.title}
								</Text>
								<Text numberOfLines={1} style={styles.artist}>
									{currentSong.artist}
								</Text>
							</Div>
						</View>
					</View>
				)}

				{/* Next Up header */}
				<View style={styles.nextUpHeader}>
					<Text style={styles.sectionHeader}>NEXT UP</Text>
					{nextUpSongs.length > 0 && (
						<Pressable onPress={clearQueue} hitSlop={8}>
							<Text style={styles.clearButton}>Clear</Text>
						</Pressable>
					)}
				</View>
			</View>
		),
		[headerComponent, currentSong, nextUpSongs.length, clearQueue, handlePlayerLayout],
	);

	const emptyComponent = useMemo(
		() => (
			<View style={styles.emptyContainer}>
				<Text style={styles.emptyText}>No upcoming songs</Text>
			</View>
		),
		[],
	);

	return (
		<DraggableFlatList
			ref={listRef}
			data={nextUpSongs}
			keyExtractor={keyExtractor}
			renderItem={renderItem}
			onDragEnd={handleReorder}
			ListHeaderComponent={listHeader}
			ListEmptyComponent={emptyComponent}
			contentContainerStyle={styles.contentContainer}
			showsVerticalScrollIndicator={false}
			activationDistance={10}
		/>
	);
});

QueueList.displayName = 'QueueList';

const styles = StyleSheet.create({
	contentContainer: {
		paddingBottom: 80,
	},
	section: {
		paddingHorizontal: 20,
		paddingTop: 24,
	},
	sectionHeader: {
		color: '#fff',
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 1,
		marginBottom: 12,
	},
	nextUpHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingTop: 24,
		paddingBottom: 4,
	},
	clearButton: {
		color: 'rgba(255, 255, 255, 0.6)',
		fontSize: 14,
		fontWeight: '600',
	},
	nowPlayingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 8,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		paddingHorizontal: 20,
		gap: 12,
	},
	rowActive: {
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		borderRadius: 8,
	},
	removeButton: {
		padding: 4,
	},
	artwork: {
		width: 40,
		height: 40,
		borderRadius: 4,
	},
	songInfo: {
		flex: 1,
		gap: 2,
	},
	title: {
		color: '#fff',
		fontSize: 15,
		fontWeight: '500',
	},
	artist: {
		color: 'rgba(255, 255, 255, 0.6)',
		fontSize: 13,
	},
	dragHandle: {
		padding: 4,
	},
	emptyContainer: {
		paddingHorizontal: 20,
		paddingVertical: 24,
	},
	emptyText: {
		color: 'rgba(255, 255, 255, 0.4)',
		fontSize: 14,
		textAlign: 'center',
	},
});
