import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { clearCacheAndReload } from '@/utils/cache';
import { plexAuthService } from '@/utils/plex-auth';
import { Main } from '@/components/Main';
import { Div } from '@/components/Div';
import { ThemedText } from '@/components';
import { Colors } from '@/constants/Colors';
import { hexWithOpacity } from '@/utils/styles';

export default function SettingsScreen() {
	const [plexToken, setPlexToken] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [authState, setAuthState] = useState(plexAuthService.getAuthState());
	const [showTokenInput, setShowTokenInput] = useState(false);
	const [pinCode, setPinCode] = useState<string | null>(null);
	const [pinStatus, setPinStatus] = useState<string>('');
	const [showAdvanced, setShowAdvanced] = useState(false);

	useEffect(() => {
		// Load existing auth state
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

	const handleSelectServer = async (serverId: string) => {
		const success = await plexAuthService.selectServer(serverId);
		if (success) {
			setAuthState(plexAuthService.getAuthState());
			Alert.alert('Success', 'Server selected successfully!');
		} else {
			Alert.alert('Error', 'Failed to connect to selected server');
		}
	};

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
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>No Servers Found</Text>
					<Text style={styles.sectionDescription}>Make sure your Plex server is running and accessible.</Text>
				</View>
			);
		}

		return (
			<View style={styles.section}>
				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Available Servers</Text>
					<TouchableOpacity onPress={handleRefreshServers} disabled={isLoading}>
						<Text style={styles.refreshButton}>Refresh</Text>
					</TouchableOpacity>
				</View>

				{authState.servers.map((server) => (
					<TouchableOpacity
						key={server.id}
						style={[styles.serverItem, authState.selectedServer?.id === server.id && styles.selectedServerItem]}
						onPress={() => handleSelectServer(server.id)}
					>
						<View style={styles.serverInfo}>
							<Text style={styles.serverName}>{server.name}</Text>
							<Text style={styles.serverDetails}>
								{server.local ? 'Local' : 'Remote'} • {server.address}:{server.port}
							</Text>
							<Text style={styles.serverId}>ID: {server.serverId}</Text>
						</View>
						{authState.selectedServer?.id === server.id && <Text style={styles.selectedIndicator}>✓</Text>}
					</TouchableOpacity>
				))}
			</View>
		);
	};

	return (
			<Main style={{ backgroundColor: '#000', paddingHorizontal: 16 }}>
				<Div>
					<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16 }}>Settings</ThemedText>
				</Div>

				{authState.isAuthenticated ? (
					<Div style={{ flex: 1, gap: 24 }}>
						<Div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
							<ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Connected as: </ThemedText>
							<ThemedText style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>{authState.username}</ThemedText>
						</Div>

						{renderServerList()}

						<TouchableOpacity
							style={[styles.clearCacheButton, isLoading && styles.disabledButton]}
							onPress={handleClearCache}
							disabled={isLoading}
						>
							{isLoading ? (
								<Div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
									<ActivityIndicator size='large' color={Colors.brand.primary} />
								</Div>
							) : (
								<Text style={styles.clearCacheButtonText}>Clear Cache & Reload Library</Text>
							)}
						</TouchableOpacity>

						<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
							<Text style={styles.logoutButtonText}>Logout</Text>
						</TouchableOpacity>
					</Div>
				) : (
					<>
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Connect to Plex</Text>
							<Text style={styles.sectionDescription}>
								Sign in with your Plex account to access your media servers.
							</Text>
						</View>

						{/* PIN-based authentication */}
						{!pinCode ? (
							<View style={styles.section}>
								<TouchableOpacity
									style={[styles.connectButton, isLoading && styles.disabledButton]}
									onPress={handlePinLogin}
									disabled={isLoading}
								>
									{isLoading ? (
										<Div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
											<ActivityIndicator size='large' color={Colors.brand.primary} />
										</Div>
									) : (
										<Text style={styles.connectButtonText}>Sign in with Plex</Text>
									)}
								</TouchableOpacity>
							</View>
						) : (
							<View style={styles.section}>
								<View style={styles.pinContainer}>
									<Text style={styles.pinLabel}>Enter this code on plex.tv/activate</Text>
									<View style={styles.pinCodeContainer}>
										<Text style={styles.pinCode}>{pinCode}</Text>
									</View>
									{pinStatus && (
										<Text style={styles.pinStatus}>{pinStatus}</Text>
									)}
									{isLoading && (
										<Div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
											<ActivityIndicator size='large' color={Colors.brand.primary} />
										</Div>
									)}
								</View>
								<TouchableOpacity
									style={styles.cancelButton}
									onPress={() => {
										setPinCode(null);
										setPinStatus('');
										setIsLoading(false);
									}}
								>
									<Text style={styles.cancelButtonText}>Cancel</Text>
								</TouchableOpacity>
							</View>
						)}

						{/* Advanced: Manual token entry */}
						<View style={styles.section}>
							<TouchableOpacity
								style={styles.advancedToggle}
								onPress={() => setShowAdvanced(!showAdvanced)}
							>
								<Text style={styles.advancedToggleText}>
									{showAdvanced ? '▼' : '▶'} Advanced: Manual Token Entry
								</Text>
							</TouchableOpacity>

							{showAdvanced && (
								<View style={styles.advancedSection}>
									<Text style={styles.sectionDescription}>
										If PIN authentication doesn't work, you can manually enter your Plex token.
									</Text>

									{showTokenInput ? (
										<View style={styles.tokenInputSection}>
											<Text style={styles.inputLabel}>Plex Token</Text>
											<TextInput
												style={styles.textInput}
												value={plexToken}
												onChangeText={setPlexToken}
												placeholder='Enter your Plex token'
												secureTextEntry
												autoCapitalize='none'
												autoCorrect={false}
											/>
											<View style={styles.buttonRow}>
												<TouchableOpacity
													style={styles.cancelButton}
													onPress={() => {
														setShowTokenInput(false);
														setPlexToken('');
													}}
												>
													<Text style={styles.cancelButtonText}>Cancel</Text>
												</TouchableOpacity>
												<TouchableOpacity
													style={[styles.loginButton, isLoading && styles.disabledButton]}
													onPress={handleTokenLogin}
													disabled={isLoading}
												>
													{isLoading ? (
														<Div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
															<ActivityIndicator size='large' color={Colors.brand.primary} />
														</Div>
													) : (
														<Text style={styles.loginButtonText}>Connect</Text>
													)}
												</TouchableOpacity>
											</View>
										</View>
									) : (
										<TouchableOpacity
											style={styles.tokenButton}
											onPress={() => setShowTokenInput(true)}
										>
											<Text style={styles.tokenButtonText}>Enter Token Manually</Text>
										</TouchableOpacity>
									)}

									<View style={styles.helpSection}>
										<Text style={styles.helpTitle}>How to get your Plex token:</Text>
										<Text style={styles.helpText}>
											1. Go to plex.tv and sign in{'\n'}
											2. Go to Settings → Network → Advanced{'\n'}
											3. Click "Show Advanced" and find "Plex Token"{'\n'}
											4. Copy the token and paste it above
										</Text>
									</View>
								</View>
							)}
						</View>
					</>
				)}
		</Main>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
	},
	scrollView: {
		flex: 1,
		padding: 20,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 30,
	},
	backButton: {
		color: '#fff',
		fontSize: 16,
		marginRight: 15,
	},
	title: {
		color: '#fff',
		fontSize: 24,
		fontWeight: 'bold',
	},
	section: {
		marginBottom: 30,
	},
	sectionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 15,
	},
	sectionTitle: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 10,
	},
	sectionDescription: {
		color: '#888',
		fontSize: 14,
		lineHeight: 20,
	},
	userInfo: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	userEmail: {
		color: '#888',
		fontSize: 14,
		marginTop: 2,
	},
	serverItem: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#111',
		padding: 15,
		borderRadius: 8,
		marginBottom: 10,
		borderWidth: 1,
		borderColor: '#333',
	},
	selectedServerItem: {
		borderColor: Colors.brand.primary,
		backgroundColor: hexWithOpacity(Colors.brand.primary, 0.1),
	},
	serverInfo: {
		flex: 1,
	},
	serverName: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	serverDetails: {
		color: '#888',
		fontSize: 12,
		marginTop: 2,
	},
	serverId: {
		color: '#666',
		fontSize: 10,
		marginTop: 2,
		fontFamily: 'monospace',
	},
	selectedIndicator: {
		color: Colors.brand.primary,
		fontSize: 20,
		fontWeight: 'bold',
	},
	refreshButton: {
		color: Colors.brand.primary,
		fontSize: 14,
		fontWeight: '600',
	},
	inputLabel: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
		marginBottom: 8,
	},
	textInput: {
		backgroundColor: '#111',
		borderRadius: 8,
		padding: 12,
		color: '#fff',
		fontSize: 16,
		borderWidth: 1,
		borderColor: '#333',
		marginBottom: 15,
	},
	buttonRow: {
		flexDirection: 'row',
		gap: 10,
	},
	connectButton: {
		backgroundColor: Colors.brand.primary,
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	connectButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	loginButton: {
		backgroundColor: Colors.brand.primary,
		padding: 12,
		borderRadius: 8,
		flex: 1,
		alignItems: 'center',
	},
	loginButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	cancelButton: {
		backgroundColor: '#333',
		padding: 12,
		borderRadius: 8,
		flex: 1,
		alignItems: 'center',
	},
	cancelButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	clearCacheButton: {
		backgroundColor: '#333',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#555',
	},
	clearCacheButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	logoutButton: {
		backgroundColor: '#FF3B30',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	logoutButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	disabledButton: {
		opacity: 0.6,
	},
	helpTitle: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 10,
	},
	helpText: {
		color: '#888',
		fontSize: 14,
		lineHeight: 20,
	},
	pinContainer: {
		backgroundColor: '#111',
		padding: 20,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#333',
		alignItems: 'center',
		marginBottom: 15,
	},
	pinLabel: {
		color: '#888',
		fontSize: 14,
		marginBottom: 15,
		textAlign: 'center',
	},
	pinCodeContainer: {
		backgroundColor: '#000',
		padding: 20,
		borderRadius: 8,
		borderWidth: 2,
		borderColor: Colors.brand.primary,
		marginBottom: 15,
		minWidth: 120,
		alignItems: 'center',
	},
	pinCode: {
		color: Colors.brand.primary,
		fontSize: 32,
		fontWeight: 'bold',
		letterSpacing: 4,
		fontFamily: 'monospace',
	},
	pinStatus: {
		color: '#888',
		fontSize: 12,
		textAlign: 'center',
		marginTop: 10,
	},
	pinLoader: {
		marginTop: 10,
	},
	advancedToggle: {
		padding: 10,
	},
	advancedToggleText: {
		color: '#888',
		fontSize: 14,
	},
	advancedSection: {
		marginTop: 10,
		paddingTop: 15,
		borderTopWidth: 1,
		borderTopColor: '#333',
	},
	tokenInputSection: {
		marginTop: 15,
	},
	tokenButton: {
		backgroundColor: '#333',
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 15,
	},
	tokenButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
	},
	helpSection: {
		marginTop: 20,
	},
});
