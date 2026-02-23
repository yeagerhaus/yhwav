import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Div, Text } from '@/components';
import { Main } from '@/components/Main';
import { DefaultStyles } from '@/constants/styles';
import { useColors, useThemedStyles } from '@/hooks/useColors';
import { useMusicDownloadsStore } from '@/hooks/useMusicDownloadsStore';
import { useOfflineModeStore } from '@/hooks/useOfflineModeStore';
import { usePodcastDownloadsStore } from '@/hooks/usePodcastDownloadsStore';
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

	const totalDownloads = musicDownloadCount + podcastDownloadCount;

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

				<TouchableOpacity
					style={[themed.cancelButton, styles.actionButton, { borderColor: colors.borderSubtle }, isLoading && DefaultStyles.buttonDisabled]}
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
					style={[themed.cancelButton, styles.actionButton, { borderColor: colors.borderSubtle }, isLoading && DefaultStyles.buttonDisabled]}
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
});
