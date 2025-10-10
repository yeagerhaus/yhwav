import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { plexAuthService } from '@/utils/plex-auth';

export default function SettingsScreen() {
	const [plexToken, setPlexToken] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [authState, setAuthState] = useState(plexAuthService.getAuthState());
	const [showTokenInput, setShowTokenInput] = useState(false);

	useEffect(() => {
		// Load existing auth state
		plexAuthService.loadAuthState().then((loaded) => {
			if (loaded) {
				setAuthState(plexAuthService.getAuthState());
			}
		});
	}, []);

	const handleLogin = async () => {
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
		<SafeAreaView style={styles.container}>
			<ScrollView style={styles.scrollView}>
				<View style={styles.header}>
					<TouchableOpacity onPress={() => router.back()}>
						<Text style={styles.backButton}>← Back</Text>
					</TouchableOpacity>
					<Text style={styles.title}>Plex Settings</Text>
				</View>

				{authState.isAuthenticated ? (
					<>
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Connected as</Text>
							<Text style={styles.userInfo}>{authState.username}</Text>
							<Text style={styles.userEmail}>{authState.email}</Text>
						</View>

						{renderServerList()}

						<View style={styles.section}>
							<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
								<Text style={styles.logoutButtonText}>Logout</Text>
							</TouchableOpacity>
						</View>
					</>
				) : (
					<>
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Connect to Plex</Text>
							<Text style={styles.sectionDescription}>Enter your Plex token to connect to your media server.</Text>
						</View>

						{showTokenInput ? (
							<View style={styles.section}>
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
										onPress={handleLogin}
										disabled={isLoading}
									>
										{isLoading ? (
											<ActivityIndicator color='#fff' size='small' />
										) : (
											<Text style={styles.loginButtonText}>Connect</Text>
										)}
									</TouchableOpacity>
								</View>
							</View>
						) : (
							<View style={styles.section}>
								<TouchableOpacity style={styles.connectButton} onPress={() => setShowTokenInput(true)}>
									<Text style={styles.connectButtonText}>Connect to Plex</Text>
								</TouchableOpacity>
							</View>
						)}

						<View style={styles.section}>
							<Text style={styles.helpTitle}>How to get your Plex token:</Text>
							<Text style={styles.helpText}>
								1. Go to plex.tv and sign in{'\n'}
								2. Go to Settings → Network → Advanced{'\n'}
								3. Click "Show Advanced" and find "Plex Token"{'\n'}
								4. Copy the token and paste it above
							</Text>
						</View>
					</>
				)}
			</ScrollView>
		</SafeAreaView>
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
		borderColor: '#007AFF',
		backgroundColor: '#001a33',
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
		color: '#007AFF',
		fontSize: 20,
		fontWeight: 'bold',
	},
	refreshButton: {
		color: '#007AFF',
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
		backgroundColor: '#007AFF',
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
		backgroundColor: '#007AFF',
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
});
