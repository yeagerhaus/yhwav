import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Div, Text } from '@/components';
import { Main } from '@/components/Main';
import { DefaultStyles } from '@/constants/styles';
import { useColors, useThemedStyles } from '@/hooks/useColors';
import { plexAuthService } from '@/utils/plex-auth';
import { hexWithOpacity } from '@/utils/styles';

export default function AccountScreen() {
	const colors = useColors();
	const themed = useThemedStyles();
	const dynamicStyles = useMemo(
		() => ({
			serverItem: { borderColor: colors.surfaceTertiary },
			selectedServerItem: { borderColor: colors.brand, backgroundColor: hexWithOpacity(colors.brand, 0.1) },
			selectedIndicator: { color: colors.brand, fontSize: 20, fontWeight: 'bold' as const },
			pinCode: {
				color: colors.brand,
				fontSize: 24,
				textAlign: 'center' as const,
				fontWeight: 'bold' as const,
				letterSpacing: 4,
				fontFamily: 'monospace',
			},
			advancedSection: { borderTopColor: colors.surfaceTertiary },
			tokenButton: { backgroundColor: colors.surfaceTertiary },
		}),
		[colors],
	);
	const [plexToken, setPlexToken] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [authState, setAuthState] = useState(plexAuthService.getAuthState());
	const [showTokenInput, setShowTokenInput] = useState(false);
	const [pinCode, setPinCode] = useState<string | null>(null);
	const [pinStatus, setPinStatus] = useState<string>('');
	const [showAdvanced, setShowAdvanced] = useState(false);

	useEffect(() => {
		plexAuthService.loadAuthState().then((loaded) => {
			if (loaded) {
				setAuthState(plexAuthService.getAuthState());
			}
		});
	}, []);

	const handlePinLogin = async () => {
		setIsLoading(true);
		setPinCode(null);
		setPinStatus('');

		try {
			const result = await plexAuthService.loginWithPin(
				(pin) => {
					setPinCode(pin);
					setPinStatus('Please authorize this app on plex.tv');
				},
				(status) => {
					setPinStatus(status);
				},
			);

			if (result.success) {
				setAuthState(result.authState!);
				setPinCode(null);
				setPinStatus('');
				Alert.alert('Success', 'Successfully connected to Plex!');
			} else {
				Alert.alert('Login Failed', result.error || 'Unknown error');
				setPinCode(null);
				setPinStatus('');
			}
		} catch (error: any) {
			Alert.alert('Error', error.message);
			setPinCode(null);
			setPinStatus('');
		} finally {
			setIsLoading(false);
		}
	};

	const handleTokenLogin = async () => {
		if (!plexToken.trim()) {
			Alert.alert('Error', 'Please enter your Plex token');
			return;
		}

		setIsLoading(true);
		try {
			const result = await plexAuthService.loginWithToken(plexToken.trim());

			if (result.success) {
				setAuthState(result.authState!);
				setPlexToken('');
				setShowTokenInput(false);
				Alert.alert('Success', 'Successfully connected to Plex!');
			} else {
				Alert.alert('Login Failed', result.error || 'Unknown error');
			}
		} catch (error: any) {
			Alert.alert('Error', error.message);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSelectServer = async (serverId: string) => {
		const success = await plexAuthService.selectServer(serverId);
		if (success) {
			setAuthState(plexAuthService.getAuthState());
			Alert.alert('Success', 'Server selected successfully!');
		} else {
			Alert.alert('Error', 'Failed to connect to selected server');
		}
	};

	const handleRefreshServers = async () => {
		setIsLoading(true);
		try {
			const success = await plexAuthService.refreshServers();
			if (success) {
				setAuthState(plexAuthService.getAuthState());
				Alert.alert('Success', 'Server list refreshed!');
			} else {
				Alert.alert('Error', 'Failed to refresh servers');
			}
		} catch (error: any) {
			Alert.alert('Error', error.message);
		} finally {
			setIsLoading(false);
		}
	};

	const renderServerList = () => {
		if (!authState.servers.length) {
			return (
				<Div style={DefaultStyles.section} transparent>
					<Text type='h3' style={DefaultStyles.sectionTitle}>
						No Servers Found
					</Text>
					<Text style={DefaultStyles.sectionDescription}>Make sure your Plex server is running and accessible.</Text>
				</Div>
			);
		}

		return (
			<Div style={DefaultStyles.section} transparent>
				<Div style={DefaultStyles.sectionHeader} transparent>
					<Text type='h3' style={DefaultStyles.sectionTitle}>
						Available Servers
					</Text>
					<TouchableOpacity onPress={handleRefreshServers} disabled={isLoading}>
						<Text type='label' colorVariant='brand'>
							Refresh
						</Text>
					</TouchableOpacity>
				</Div>

				{authState.servers.map((server) => (
					<TouchableOpacity
						key={server.id}
						style={[
							styles.serverItem,
							dynamicStyles.serverItem,
							{ backgroundColor: hexWithOpacity(colors.background, 0.5) },
							authState.selectedServer?.id === server.id && dynamicStyles.selectedServerItem,
						]}
						onPress={() => handleSelectServer(server.id)}
					>
						<Div transparent style={styles.serverInfo}>
							<Text type='h4' style={styles.serverName}>
								{server.name}
							</Text>
							<Text type='bodySM' colorVariant='secondary' style={styles.serverDetails}>
								{server.local ? 'Local' : 'Remote'} • {server.address}:{server.port} {/* 192.168.X.X:X PLACEHOLDER */}
							</Text>
							<Text type='bodyXS' colorVariant='secondary' style={styles.serverId}>
								ID: {server.serverId} {/* XXXX PLACEHOLDER */}
							</Text>
						</Div>
						{authState.selectedServer?.id === server.id && <Text style={dynamicStyles.selectedIndicator}>✓</Text>}
					</TouchableOpacity>
				))}
			</Div>
		);
	};

	return (
		<Main style={{ paddingHorizontal: 16 }}>
			<Div transparent>
				<Text type='h1' style={{ marginBottom: 16 }}>
					Account & Server
				</Text>
			</Div>

			{authState.isAuthenticated ? (
				<Div transparent flex={1} style={{ gap: 24 }}>
					{renderServerList()}
				</Div>
			) : (
				<>
					<Div style={DefaultStyles.section}>
						<Text type='h2'>Connect to Plex</Text>
						<Text style={DefaultStyles.sectionDescription}>Sign in with your Plex account to access your media servers.</Text>
					</Div>

					{!pinCode ? (
						<Div style={DefaultStyles.section}>
							<TouchableOpacity
								style={[themed.primaryButton, styles.connectButtonPadding, isLoading && DefaultStyles.buttonDisabled]}
								onPress={handlePinLogin}
								disabled={isLoading}
							>
								{isLoading ? (
									<Div transparent style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
										<ActivityIndicator size='large' color={colors.brand} />
									</Div>
								) : (
									<Text type='body' colorVariant='primaryInvert'>
										Sign in with Plex
									</Text>
								)}
							</TouchableOpacity>
						</Div>
					) : (
						<Div style={DefaultStyles.section}>
							<Div transparent style={themed.pinContainer}>
								<Text type='body'>Enter this code on plex.tv/activate</Text>
								<Div transparent style={themed.pinCodeContainer}>
									<Text style={dynamicStyles.pinCode}>{pinCode}</Text>
								</Div>
								{pinStatus && <Text type='body'>{pinStatus}</Text>}
								{isLoading && (
									<Div transparent style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
										<ActivityIndicator size='large' color={colors.brand} />
									</Div>
								)}
							</Div>
							<TouchableOpacity
								style={themed.cancelButton}
								onPress={() => {
									setPinCode(null);
									setPinStatus('');
									setIsLoading(false);
								}}
							>
								<Text type='body' colorVariant='primaryInvert'>
									Cancel
								</Text>
							</TouchableOpacity>
						</Div>
					)}

					<Div style={DefaultStyles.section}>
						<TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
							<Text type='body' style={styles.advancedToggleText}>
								{showAdvanced ? '▼' : '▶'} Advanced: Manual Token Entry
							</Text>
						</TouchableOpacity>

						{showAdvanced && (
							<Div style={[styles.advancedSection, dynamicStyles.advancedSection]}>
								<Text style={DefaultStyles.sectionDescription}>
									If PIN authentication doesn't work, you can manually enter your Plex token.
								</Text>

								{showTokenInput ? (
									<Div style={styles.tokenInputSection}>
										<Text style={DefaultStyles.inputLabel}>Plex Token</Text>
										<TextInput
											style={themed.input}
											value={plexToken}
											onChangeText={setPlexToken}
											placeholder='Enter your Plex token'
											placeholderTextColor={colors.textMuted}
											secureTextEntry
											autoCapitalize='none'
											autoCorrect={false}
										/>
										<Div style={DefaultStyles.buttonRow}>
											<TouchableOpacity
												style={[themed.cancelButton, styles.flex1]}
												onPress={() => {
													setShowTokenInput(false);
													setPlexToken('');
												}}
											>
												<Text type='body' colorVariant='primaryInvert'>
													Cancel
												</Text>
											</TouchableOpacity>
											<TouchableOpacity
												style={[themed.primaryButton, styles.flex1, isLoading && DefaultStyles.buttonDisabled]}
												onPress={handleTokenLogin}
												disabled={isLoading}
											>
												{isLoading ? (
													<Div
														style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}
													>
														<ActivityIndicator size='large' color={colors.brand} />
													</Div>
												) : (
													<Text type='body' colorVariant='primaryInvert'>
														Connect
													</Text>
												)}
											</TouchableOpacity>
										</Div>
									</Div>
								) : (
									<TouchableOpacity
										style={[styles.tokenButton, dynamicStyles.tokenButton]}
										onPress={() => setShowTokenInput(true)}
									>
										<Text type='label' colorVariant='primaryInvert'>
											Enter Token Manually
										</Text>
									</TouchableOpacity>
								)}

								<Div style={styles.helpSection}>
									<Text type='body' style={styles.helpTitle}>
										How to get your Plex token:
									</Text>
									<Text style={DefaultStyles.sectionDescription}>
										1. Go to plex.tv and sign in{'\n'}
										2. Go to Settings → Network → Advanced{'\n'}
										3. Click "Show Advanced" and find "Plex Token"{'\n'}
										4. Copy the token and paste it above
									</Text>
								</Div>
							</Div>
						)}
					</Div>
				</>
			)}
		</Main>
	);
}

const styles = StyleSheet.create({
	serverItem: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 15,
		borderRadius: 8,
		marginBottom: 10,
		borderWidth: 1,
	},
	serverInfo: {
		flex: 1,
	},
	serverName: {
		fontSize: 16,
		fontWeight: '600',
	},
	serverDetails: {
		marginTop: 2,
	},
	serverId: {
		marginTop: 2,
		fontFamily: 'monospace',
	},
	advancedToggle: {
		padding: 10,
	},
	advancedToggleText: {
		fontSize: 14,
	},
	advancedSection: {
		marginTop: 10,
		paddingTop: 15,
		borderTopWidth: 1,
	},
	tokenInputSection: {
		marginTop: 15,
	},
	tokenButton: {
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 15,
	},
	helpSection: {
		marginTop: 20,
	},
	helpTitle: {
		marginBottom: 10,
	},
	connectButtonPadding: {
		paddingVertical: 15,
	},
	flex1: {
		flex: 1,
	},
});
