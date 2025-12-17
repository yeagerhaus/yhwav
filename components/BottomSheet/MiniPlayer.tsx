import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants';
import { useAudioStore } from '@/hooks/useAudioStore';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Div } from '../Div';

export function MiniPlayer({ onPress }: { onPress: () => void }) {
	const insets = useSafeAreaInsets();

	// Calculate bottom position considering tab bar height
	const bottomPosition = Platform.OS === 'ios' ? insets.bottom + 57 : 60;

	return (
		<Pressable onPress={onPress} style={[styles.container, { bottom: bottomPosition }]}>
			<Div useGlass style={styles.content}>
				<MiniPlayerContent />
			</Div>
		</Pressable>
	);
}

// Extract the content into a separate component for reusability
const MiniPlayerContent = React.memo(() => {
	const colorScheme = useColorScheme();
	const currentSong = useAudioStore((state) => state.currentSong);
	const isPlaying = useAudioStore((state) => state.isPlaying);
	const togglePlayPause = useAudioStore((state) => state.togglePlayPause);
	const skipToNext = useAudioStore((state) => state.skipToNext);

	const artwork = React.useMemo(() => currentSong?.artworkUrl || currentSong?.artwork, [currentSong?.artworkUrl, currentSong?.artwork]);
	const title = React.useMemo(() => currentSong?.title, [currentSong?.title]);

	if (!currentSong) return null;

	return (
		<ThemedView style={[styles.miniPlayerContent, { backgroundColor: colorScheme === 'light' ? '#ffffffa4' : 'transparent' }]}>
			<Image source={{ uri: artwork }} style={styles.artwork} />
			<ThemedView style={styles.textContainer}>
				<ThemedText style={styles.title}>{title}</ThemedText>
			</ThemedView>
			<ThemedView style={styles.controls}>
				<Pressable style={styles.controlButton} onPress={togglePlayPause}>
					<SymbolView
						name={isPlaying ? 'pause.fill' : 'play.fill'}
						type='hierarchical'
						size={20}
						tintColor={Colors.brand.primary}
					/>
				</Pressable>
				<Pressable style={styles.controlButton} onPress={skipToNext}>
					<SymbolView name='forward.fill' type='hierarchical' size={24} tintColor={Colors.brand.primary} />
				</Pressable>
			</ThemedView>
		</ThemedView>
	);
});

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		left: 0,
		right: 0,
		height: 56,
		zIndex: 1000,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 5,
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
		// height: 40,
		marginHorizontal: 20,
		borderRadius: 100,
		overflow: 'hidden',
		zIndex: 1000,
		flex: 1,
		paddingVertical: 0,
	},
	miniPlayerContent: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		height: '100%',
		paddingHorizontal: 10,
		// backgroundColor: '#ffffffa4',
	},
	androidContainer: {},
	title: {
		fontWeight: '500',
	},
	artwork: {
		marginLeft: 8,
		width: 40,
		height: 40,
		borderRadius: 8,
	},
	textContainer: {
		flex: 1,
		marginLeft: 12,
		backgroundColor: 'transparent',
	},
	controls: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginRight: 4,
		backgroundColor: 'transparent',
	},
	controlButton: {
		padding: 8,
	},
});
