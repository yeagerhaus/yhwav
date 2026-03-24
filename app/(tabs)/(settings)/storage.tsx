import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Div, Text } from '@/components';
import { Main } from '@/components/Main';
import { DefaultStyles } from '@/constants/styles';
import { useColors, useThemedStyles } from '@/hooks/useColors';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { usePodcastDownloadsStore } from '@/hooks/usePodcastDownloadsStore';
import type { Song } from '@/types/song';
import { clearCacheAndReload } from '@/utils/cache';
import { hexWithOpacity } from '@/utils/styles';

export default function StorageScreen() {
	const colors = useColors();
	const themed = useThemedStyles();
	const [isLoading, setIsLoading] = useState(false);
	const offlineMode = useOfflineModeStore((state) => state.offlineMode);
	const setOfflineMode = useOfflineModeStore((state) => state.setOfflineMode);
	const musicDownloadCount = useMusicDownloadsStore((s) => Object.keys(s.downloads).length);
	const podcastDownloadCount = usePodcastDownloadsStore((s) => Object.keys(s.downloads).length);
	const removeAllMusicDownloads = useMusicDownloadsStore((s) => s.removeAllDownloads);
	const removeAllPodcastDownloads = usePodcastDownloadsStore((s) => s.removeAllDownloads);

	const queue = useMusicDownloadsStore((s) => s.queue);
	const downloading = useMusicDownloadsStore((s) => s.downloading);
	const queueTotal = useMusicDownloadsStore((s) => s.queueTotal);
	const queueCompleted = useMusicDownloadsStore((s) => s.queueCompleted);
	const cancelQueue = useMusicDownloadsStore((s) => s.cancelQueue);

	const totalDownloads = musicDownloadCount + podcastDownloadCount;
	const queueActive = queueTotal > 0;
	const progressFraction = queueTotal > 0 ? queueCompleted / queueTotal : 0;

	const handleClearCache = async () => {
		Alert.alert(
			'Clear Cache & Reload',
			'This will clear all cached library data and re-fetch everything from the server. This may take a moment for large libraries.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Clear & Reload',
					style: 'destructive',
					onPress: async () => {
						setIsLoading(true);
						try {
							const count = await clearCacheAndReload();
							if (count > 0) {
								Alert.alert('Success', `Reloaded ${count.toLocaleString()} tracks from server.`);
							} else {
								Alert.alert('Error', 'Failed to reload library. Check your server connection.');
							}
						} catch (error: any) {
							Alert.alert('Error', error.message);
						} finally {
							setIsLoading(false);
						}
					},
				},
			],
		);
	};

	const handleRemoveAllDownloads = () => {
		if (totalDownloads === 0) {
			Alert.alert('No Downloads', 'There are no downloaded files to remove.');
			return;
		}
		Alert.alert(
			'Remove All Downloads',
			`This will delete ${totalDownloads} downloaded file${totalDownloads === 1 ? '' : 's'} (${musicDownloadCount} music, ${podcastDownloadCount} podcast). This cannot be undone.`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Remove All',
					style: 'destructive',
					onPress: async () => {
						setIsLoading(true);
						try {
							await Promise.all([removeAllMusicDownloads(), removeAllPodcastDownloads()]);
							Alert.alert('Done', 'All downloads have been removed.');
						} catch (error: any) {
							Alert.alert('Error', error.message);
						} finally {
							setIsLoading(false);
						}
					},
				},
			],
		);
	};

	const downloadingCount = downloading.size;
	const remaining = queue.length + downloadingCount;

	return (
		<Main style={{ paddingHorizontal: 16 }}>
			<Div transparent>
				<Text type='h1' style={{ marginBottom: 16 }}>
					Storage & Data
				</Text>
			</Div>

			<Div flex={1} transparent style={{ gap: 24 }}>
				<Div style={[DefaultStyles.section, styles.section]} transparent>
					<Text type='h3' style={DefaultStyles.sectionTitle}>
						Offline mode
					</Text>
					<Text style={[DefaultStyles.sectionDescription, { marginBottom: 8 }]}>
						Use only cached data and downloads; no new fetches for library or podcasts.
					</Text>
					<Div style={styles.switchRow} transparent>
						<Text type='body'>Offline mode</Text>
						<Switch
							value={offlineMode}
							onValueChange={setOfflineMode}
							trackColor={{ false: colors.surfaceTertiary, true: hexWithOpacity(colors.brand, 0.5) }}
							thumbColor={offlineMode ? colors.brand : colors.textMuted}
						/>
					</Div>
				</Div>

				<Div style={[DefaultStyles.section, styles.section]} transparent>
					<Text type='h3' style={DefaultStyles.sectionTitle}>
						Download Queue
					</Text>
					{queueActive ? (
						<>
							<Text type='bodySM' colorVariant='secondary' style={{ marginBottom: 8 }}>
								{queueCompleted} of {queueTotal} completed · {remaining} remaining
							</Text>
							<View style={[styles.progressTrack, { backgroundColor: colors.surfaceTertiary }]}>
								<View
									style={[
										styles.progressFill,
										{
											backgroundColor: colors.brand,
											width: `${Math.round(progressFraction * 100)}%`,
										},
									]}
								/>
							</View>

							{downloadingCount > 0 && (
								<Div transparent style={{ marginTop: 12 }}>
									<View style={styles.activeRow}>
										<ActivityIndicator size='small' color={colors.brand} style={{ marginRight: 8 }} />
										<Text type='label'>Downloading now</Text>
									</View>
								</Div>
							)}

							{queue.length > 0 && (
								<Div transparent style={{ marginTop: 12 }}>
									<Text type='label' style={{ marginBottom: 4 }}>
										Up next ({queue.length})
									</Text>
									<FlatList
										data={queue}
										keyExtractor={(item) => item.id}
										renderItem={({ item }) => <QueueItem song={item} />}
										scrollEnabled={false}
									/>
								</Div>
							)}

							<TouchableOpacity
								style={[themed.cancelButton, styles.actionButton, { borderColor: colors.danger, marginTop: 12 }]}
								onPress={() =>
									Alert.alert(
										'Cancel Downloads',
										`Cancel ${remaining} remaining download${remaining === 1 ? '' : 's'}?`,
										[
											{ text: 'No', style: 'cancel' },
											{ text: 'Cancel Downloads', style: 'destructive', onPress: cancelQueue },
										],
									)
								}
							>
								<Text type='h3' style={{ color: colors.danger }}>
									Cancel Queue
								</Text>
							</TouchableOpacity>
						</>
					) : (
						<Text type='bodySM' colorVariant='secondary'>
							No active downloads
						</Text>
					)}
				</Div>

				<TouchableOpacity
					style={[
						themed.cancelButton,
						styles.actionButton,
						{ borderColor: colors.borderSubtle },
						isLoading && DefaultStyles.buttonDisabled,
					]}
					onPress={handleClearCache}
					disabled={isLoading}
				>
					{isLoading ? (
						<Div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
							<ActivityIndicator size='large' color={colors.brand} />
						</Div>
					) : (
						<Text type='h3'>Clear Cache & Reload Library</Text>
					)}
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						themed.cancelButton,
						styles.actionButton,
						{ borderColor: colors.borderSubtle },
						isLoading && DefaultStyles.buttonDisabled,
					]}
					onPress={handleRemoveAllDownloads}
					disabled={isLoading}
				>
					<Text type='h3'>Remove All Downloads</Text>
					{totalDownloads > 0 && (
						<Text type='bodySM' colorVariant='secondary' style={{ marginTop: 2 }}>
							{musicDownloadCount} music · {podcastDownloadCount} podcast
						</Text>
					)}
				</TouchableOpacity>
			</Div>
		</Main>
	);
}

function QueueItem({ song, isActive }: { song: Song; isActive?: boolean }) {
	const colors = useColors();
	return (
		<View style={[styles.queueItem, { borderBottomColor: colors.borderSubtle }]}>
			{isActive && <ActivityIndicator size='small' color={colors.brand} style={{ marginRight: 10 }} />}
			<View style={{ flex: 1 }}>
				<Text type='bodySM' numberOfLines={1}>
					{song.title}
				</Text>
				<Text type='bodyXS' colorVariant='secondary' numberOfLines={1}>
					{song.artist} — {song.album}
				</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		marginTop: 8,
	},
	switchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 8,
	},
	actionButton: {
		borderWidth: 1,
	},
	progressTrack: {
		height: 6,
		borderRadius: 3,
		overflow: 'hidden',
	},
	progressFill: {
		height: '100%',
		borderRadius: 3,
	},
	activeRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	queueItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
});
