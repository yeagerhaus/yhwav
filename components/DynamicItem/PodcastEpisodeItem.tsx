import { SymbolView } from 'expo-symbols';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Text } from '@/components/Text';
import { Colors } from '@/constants/styles';
import { useAudioStore } from '@/hooks/useAudioStore';
import { toPlayableSong } from '@/types';
import type { PodcastEpisode } from '@/types/podcast';
import type { Song } from '@/types/song';
import { Div } from '../Div';

function formatDuration(seconds: number | undefined): string {
	if (seconds == null || seconds <= 0) return '';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(pubDate: string | undefined): string {
	if (!pubDate) return '';
	try {
		const d = new Date(pubDate);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	} catch {
		return pubDate;
	}
}

export interface PodcastEpisodeItemProps {
	episode: PodcastEpisode;
	showTitle: string;
	showImageUrl?: string;
	queue?: Song[];
	listItem?: boolean;
}

const PodcastEpisodeItem = React.memo(
	({ episode, showTitle, showImageUrl, queue, listItem = true }: PodcastEpisodeItemProps) => {
		const colorScheme = useColorScheme();
		const currentSong = useAudioStore((state) => state.currentSong);
		const playSound = useAudioStore((state) => state.playSound);

		const isCurrentSong = useMemo(
			() => currentSong?.id === episode.id,
			[episode.id, currentSong?.id],
		);

		const handlePress = useCallback(() => {
			const song = toPlayableSong(episode, showTitle, showImageUrl);
			playSound(song, queue ?? [song]);
		}, [episode, showTitle, showImageUrl, queue, playSound]);

		const subtitle = useMemo(() => {
			const parts: string[] = [];
			if (episode.pubDate) parts.push(formatDate(episode.pubDate));
			if (episode.durationSeconds != null && episode.durationSeconds > 0) {
				parts.push(formatDuration(episode.durationSeconds));
			}
			return parts.length > 0 ? parts.join(' · ') : showTitle;
		}, [episode.pubDate, episode.durationSeconds, showTitle]);

		return (
			<Pressable onPress={handlePress} style={styles.row}>
				<Div style={[styles.info, { borderBottomColor: colorScheme === 'light' ? Colors.listDividerLight : Colors.listDividerDark }]} transparent>
					<Text type="defaultSemiBold" numberOfLines={1} style={styles.title}>
						{episode.title}
					</Text>
					<Div style={styles.subtitleRow} transparent>
						{isCurrentSong && <SymbolView name="music.note" size={12} tintColor={Colors.brandPrimary} />}
						<Text type="subtitle" numberOfLines={1} style={styles.subtitle}>
							{subtitle}
						</Text>
					</Div>
				</Div>
			</Pressable>
		);
	},
	(prev, next) =>
		prev.episode.id === next.episode.id &&
		prev.episode.title === next.episode.title &&
		prev.showTitle === next.showTitle &&
		prev.listItem === next.listItem &&
		prev.queue?.length === next.queue?.length,
);

PodcastEpisodeItem.displayName = 'PodcastEpisodeItem';

export default PodcastEpisodeItem;

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 12,
	},
	info: {
		flex: 1,
		gap: 4,
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 4,
		paddingRight: 4,
		minWidth: 0,
	},
	subtitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	title: {
		fontSize: 15,
		fontWeight: '400',
	},
	subtitle: {
		fontSize: 14,
		fontWeight: '400',
		opacity: 0.6,
		marginTop: -4,
	},
});
