import { SymbolView } from 'expo-symbols';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { Text } from '@/components/Text';
import { Colors } from '@/constants/styles';
import { useAudioStore } from '@/hooks/useAudioStore';
import { usePodcastProgressStore } from '@/hooks/usePodcastProgressStore';
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
		const progress = usePodcastProgressStore((state) => state.progressByEpisodeId[episode.id]);

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

		const canResume = progress && !progress.completed && progress.position > 10;
		const progressPercent =
			progress && progress.duration > 0 ? Math.min(1, progress.position / progress.duration) : 0;

		return (
			<Pressable onPress={handlePress} style={styles.row}>
				<Div style={[styles.info, { borderBottomColor: colorScheme === 'light' ? Colors.listDividerLight : Colors.listDividerDark }]} transparent>
					<Text type="h3" numberOfLines={1} style={styles.title}>
						{episode.title}
					</Text>
					<Div style={styles.subtitleRow} transparent>
						<Text type="bodySM" numberOfLines={4} style={styles.subtitle}>
							{episode.description}
						</Text>
					</Div>
					<Div style={styles.subtitleRow} transparent>
						{canResume && (
							<Text type="bodyXS" numberOfLines={1} style={[styles.subtitle, styles.resumeLabel]}>
								Resume from {formatDuration(Math.floor(progress.position))}
							</Text>
						)}
						<Text type="bodyXS" numberOfLines={1} style={styles.subtitle}>
							{subtitle}
						</Text>
					</Div>
					{canResume && progressPercent > 0 && (
						<View style={styles.progressTrack}>
							<View style={[styles.progressFill, { width: `${progressPercent * 100}%` }]} />
						</View>
					)}
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
		gap: 8,
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
		fontWeight: '400',
	},
	subtitle: {
		fontWeight: '400',
		opacity: 0.6,
		marginTop: -4,
	},
	resumeLabel: {
		color: Colors.brandPrimary,
		marginRight: 6,
	},
	progressTrack: {
		height: 3,
		borderRadius: 1.5,
		backgroundColor: 'rgba(128,128,128,0.3)',
		marginTop: 4,
		overflow: 'hidden',
	},
	progressFill: {
		height: '100%',
		borderRadius: 1.5,
		backgroundColor: Colors.brandPrimary,
	},
});
