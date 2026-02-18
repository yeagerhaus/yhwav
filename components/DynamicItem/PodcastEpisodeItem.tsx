import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { Text } from '@/components/Text';
import { Colors } from '@/constants/styles';
import { useAudioStore } from '@/hooks/useAudioStore';
import { usePodcastDownloadsStore } from '@/hooks/usePodcastDownloadsStore';
import { usePodcastProgressStore } from '@/hooks/usePodcastProgressStore';
import { toPlayableSong } from '@/types';
import type { PodcastDownload, PodcastEpisode, PodcastFeed } from '@/types/podcast';
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
	episode: PodcastEpisode | PodcastDownload;
	showTitle: string;
	showImageUrl?: string;
	queue?: Song[];
	listItem?: boolean;
	feed?: PodcastFeed;
}

function isDownload(ep: PodcastEpisode | PodcastDownload): ep is PodcastDownload {
	return 'localUri' in ep && 'downloadedAt' in ep;
}

const PodcastEpisodeItem = React.memo(
	// biome-ignore lint/correctness/noUnusedFunctionParameters: feed is used via alias _feed
	({ episode, showTitle, showImageUrl, queue, listItem = true, feed: _feed }: PodcastEpisodeItemProps) => {
		const colorScheme = useColorScheme();
		const currentSong = useAudioStore((state) => state.currentSong);
		const playSound = useAudioStore((state) => state.playSound);
		const progress = usePodcastProgressStore((state) => state.progressByEpisodeId[episode.id]);
		const getLocalUri = usePodcastDownloadsStore((s) => s.getLocalUri);
		const isDownloaded = usePodcastDownloadsStore((s) => s.isDownloaded(episode.id));
		const isDownloading = usePodcastDownloadsStore((s) => s.isDownloading(episode.id));
		const downloadEpisode = usePodcastDownloadsStore((s) => s.downloadEpisode);
		const removeDownload = usePodcastDownloadsStore((s) => s.removeDownload);

		const isCurrentSong = useMemo(() => currentSong?.id === episode.id, [episode.id, currentSong?.id]);

		const localUri = useMemo(() => (isDownload(episode) ? episode.localUri : getLocalUri(episode.id)), [episode, getLocalUri]);

		const handlePress = useCallback(() => {
			const song = toPlayableSong(episode, showTitle, showImageUrl, localUri);
			playSound(song, queue ?? [song]);
		}, [episode, showTitle, showImageUrl, queue, playSound, localUri]);

		const handleDownloadPress = useCallback(() => {
			if (!_feed || isDownload(episode)) {
				removeDownload(episode.id).catch(() => {});
				return;
			}
			downloadEpisode(episode as PodcastEpisode, _feed).catch(() => {});
		}, [_feed, episode, removeDownload, downloadEpisode]);

		const subtitle = useMemo(() => {
			const parts: string[] = [];
			if (episode.pubDate) parts.push(formatDate(episode.pubDate));
			if (episode.durationSeconds != null && episode.durationSeconds > 0) {
				parts.push(formatDuration(episode.durationSeconds));
			}
			return parts.length > 0 ? parts.join(' · ') : showTitle;
		}, [episode.pubDate, episode.durationSeconds, showTitle]);

		const description = useMemo(() => {
			if ('description' in episode && episode.description) return episode.description;
			return null;
		}, [episode]);

		const canResume = progress && !progress.completed && progress.position > 10;
		const progressPercent = progress && progress.duration > 0 ? Math.min(1, progress.position / progress.duration) : 0;

		return (
			<Pressable onPress={handlePress} style={styles.row}>
				<Div
					style={[styles.info, { borderBottomColor: colorScheme === 'light' ? Colors.listDividerLight : Colors.listDividerDark }]}
					transparent
				>
					<Div style={styles.titleRow} transparent>
						<Text type='h3' numberOfLines={1} style={[styles.title, { flex: 1, color: isCurrentSong ? Colors.brandPrimary : Colors.white }]}>
							{episode.title}
						</Text>
						{_feed != null && (
							<Pressable
								onPress={(e) => {
									e.stopPropagation();
									handleDownloadPress();
								}}
								hitSlop={8}
								style={styles.downloadButton}
								disabled={isDownloading}
							>
								{isDownloading ? (
									<ActivityIndicator size='small' color={Colors.brandPrimary} />
								) : isDownloaded || isDownload(episode) ? (
									<Ionicons name='checkmark-circle' size={22} color={Colors.brandPrimary} />
								) : (
									<Ionicons name='download-outline' size={22} color={Colors.brandPrimary} />
								)}
							</Pressable>
						)}
					</Div>
					{description != null && (
						<Div style={styles.subtitleRow} transparent>
							<Text type='bodySM' numberOfLines={4} style={styles.subtitle}>
								{description}
							</Text>
						</Div>
					)}
					<Div style={styles.subtitleRow} transparent>
						{canResume && (
							<Text type='bodyXS' numberOfLines={1} style={[styles.subtitle, styles.resumeLabel]}>
								Resume from {formatDuration(Math.floor(progress.position))}
							</Text>
						)}
						<Text type='bodyXS' numberOfLines={1} style={styles.subtitle}>
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
		prev.feed?.id === next.feed?.id &&
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
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	downloadButton: {
		padding: 4,
		minWidth: 30,
		alignItems: 'center',
		justifyContent: 'center',
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
		marginBottom: 8,
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
