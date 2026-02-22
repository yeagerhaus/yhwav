import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { type SFSymbol, SymbolView } from 'expo-symbols';
import { Div, Text } from '@/components';
import { Main } from '@/components/Main';
import { Colors, DefaultStyles } from '@/constants/styles';
import { plexAuthService } from '@/utils/plex-auth';

function SettingsRow({ label, icon, onPress }: { label: string; icon: SFSymbol; onPress: () => void }) {
	return (
		<TouchableOpacity style={styles.settingsRow} onPress={onPress}>
			<SymbolView name={icon} type='hierarchical' tintColor={Colors.brandPrimary} size={22} />
			<Text type='body' style={styles.settingsRowLabel}>
				{label}
			</Text>
			<SymbolView name='chevron.right' type='hierarchical' tintColor={Colors.textMuted} size={14} />
		</TouchableOpacity>
	);
}

export default function SettingsScreen() {
	const router = useRouter();
	const [authState, setAuthState] = useState(plexAuthService.getAuthState());
	const [refreshing, setRefreshing] = useState(false);

	const refreshAuthState = useCallback(async () => {
		const loaded = await plexAuthService.loadAuthState();
		if (loaded) {
			setAuthState(plexAuthService.getAuthState());
		}
	}, []);

	useEffect(() => {
		refreshAuthState();
	}, [refreshAuthState]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await refreshAuthState();
		setRefreshing(false);
	}, [refreshAuthState]);

	const handleLogout = async () => {
		Alert.alert('Logout', 'Are you sure you want to logout?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Logout',
				style: 'destructive',
				onPress: async () => {
					await plexAuthService.logout();
					setAuthState(plexAuthService.getAuthState());
				},
			},
		]);
	};

	return (
		<Main style={{ paddingHorizontal: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandPrimary} />}>
			<Div transparent>
				<Text type='h1' style={{ marginBottom: 16 }}>
					Settings
				</Text>
			</Div>

			{authState.isAuthenticated && (
				<Div transparent display='flex' flexDirection='row' justifyContent='space-between' alignItems='center' style={{ marginBottom: 24 }}>
					<Div display='flex' flex={1} transparent style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
					{authState.avatarUrl ? (
						<Image source={{ uri: authState.avatarUrl }} style={styles.avatar} />
					) : (
						<Div transparent style={[styles.avatar, styles.avatarFallback]}>
							<Text type='h3' colorVariant='primaryInvert'>
								{authState.username?.charAt(0)?.toUpperCase() ?? '?'}
							</Text>
						</Div>
					)}
						<Div transparent display='flex' flex={1}>
							<Text type='bodyXS' colorVariant='muted'>
								Connected as
							</Text>
							<Text type='h3'>{authState.username}</Text>
						</Div>
					</Div>
					{/* <SymbolView name='rectangle.portrait.and.arrow.right.fill' type='hierarchical' tintColor={Colors.textMuted} size={32} /> */}
					<TouchableOpacity onPress={handleLogout}>
						<Text type='link' colorVariant='brand'>
							Logout
						</Text>
					</TouchableOpacity>
				</Div>
			)}

			<Div transparent style={{ gap: 2 }}>
				<SettingsRow
					label='Account & Server'
					icon='person.crop.circle'
					onPress={() => router.push('/(tabs)/(settings)/account')}
				/>
				<SettingsRow
					label='Appearance'
					icon='paintbrush'
					onPress={() => router.push('/(tabs)/(settings)/appearance')}
				/>
				<SettingsRow
					label='Playback'
					icon='waveform'
					onPress={() => router.push('/(tabs)/(settings)/playback')}
				/>
				<SettingsRow
					label='Storage & Data'
					icon='externaldrive'
					onPress={() => router.push('/(tabs)/(settings)/storage')}
				/>
				{__DEV__ && (
					<SettingsRow
						label='Developer'
						icon='wrench.and.screwdriver'
						onPress={() => router.push('/(tabs)/(settings)/developer')}
					/>
				)}
			</Div>
		</Main>
	);
}

const styles = StyleSheet.create({
	avatar: {
		width: 44,
		height: 44,
		borderRadius: 22,
	},
	avatarFallback: {
		backgroundColor: Colors.brandPrimary,
		justifyContent: 'center',
		alignItems: 'center',
	},
	settingsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 14,
		paddingHorizontal: 4,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.surfaceDark,
	},
	settingsRowLabel: {
		flex: 1,
		marginLeft: 12,
	},
});
