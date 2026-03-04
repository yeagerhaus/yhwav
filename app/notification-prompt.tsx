import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Div } from '@/components';
import { Text } from '@/components/Text';
import { useColors } from '@/hooks/useColors';
import { requestNotificationPermissions } from '@/utils/notifications';

const PROMPT_DISMISSED_KEY = 'NOTIFICATION_PROMPT_SEEN';

export async function hasSeenNotificationPrompt(): Promise<boolean> {
	const val = await AsyncStorage.getItem(PROMPT_DISMISSED_KEY);
	return val === 'true';
}

async function markPromptSeen() {
	await AsyncStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
}

export default function NotificationPromptScreen() {
	const router = useRouter();
	const colors = useColors();
	const isDark = useColorScheme() === 'dark';

	const handleEnable = async () => {
		await markPromptSeen();
		await requestNotificationPermissions();
		router.back();
	};

	const handleSkip = async () => {
		await markPromptSeen();
		router.back();
	};

	return (
		<Div style={[styles.container, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)' }]}>
			<Div style={[styles.card, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
				<Div transparent style={styles.iconContainer}>
					<Div style={[styles.iconCircle, { backgroundColor: `${colors.brand}20` }]}>
						<SymbolView name='bell.badge.fill' size={40} tintColor={colors.brand} />
					</Div>
				</Div>

				<Text type='h2' style={styles.title}>
					Stay up to date
				</Text>

				<Text type='body' colorVariant='muted' style={styles.description}>
					Get notified when new podcast episodes drop so you never miss a release.
				</Text>

				<Pressable onPress={handleEnable} style={[styles.enableButton, { backgroundColor: colors.brand }]}>
					<Text type='body' style={styles.enableButtonText}>
						Enable Notifications
					</Text>
				</Pressable>

				<Pressable onPress={handleSkip} style={styles.skipButton}>
					<Text type='body' colorVariant='muted' style={styles.skipButtonText}>
						Not Now
					</Text>
				</Pressable>
			</Div>
		</Div>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
	},
	card: {
		width: '100%',
		borderRadius: 20,
		paddingVertical: 36,
		paddingHorizontal: 28,
		alignItems: 'center',
	},
	iconContainer: {
		marginBottom: 20,
	},
	iconCircle: {
		width: 80,
		height: 80,
		borderRadius: 40,
		justifyContent: 'center',
		alignItems: 'center',
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
		textAlign: 'center',
		marginBottom: 10,
	},
	description: {
		textAlign: 'center',
		lineHeight: 22,
		marginBottom: 28,
		paddingHorizontal: 8,
	},
	enableButton: {
		width: '100%',
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: 'center',
		marginBottom: 12,
	},
	enableButtonText: {
		color: '#fff',
		fontWeight: '600',
		fontSize: 16,
	},
	skipButton: {
		paddingVertical: 8,
	},
	skipButtonText: {
		fontSize: 15,
	},
});
