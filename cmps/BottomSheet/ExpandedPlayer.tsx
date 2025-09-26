import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View as ThemedView } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudio } from '@/ctx/AudioContext';
import { useSong } from '@/ctx/SongContext';
import { ExtraControls } from '../Player/ExtraControls';
import { PlaybackControls } from '../Player/PlaybackControls';
import { SongInfo } from '../Player/SongInfo';
import { SongProgressBar } from '../Player/SongProgressBar';
import { TimeDisplay } from '../Player/TimeDisplay';

interface ExpandedPlayerProps {
	scrollComponent?: (props: any) => React.ReactElement;
}

export const ExpandedPlayer = React.memo(
	({ scrollComponent }: ExpandedPlayerProps) => {
		const ScrollComponentToUse = scrollComponent || ScrollView;
		const { artworkBgColor } = useAudio();
		const { currentSong } = useSong();

		const insets = useSafeAreaInsets();
		const colorToUse = artworkBgColor || '#000000';
		const colors: [string, string] = [colorToUse, colorToUse];

		// Memoize the scroll component to prevent unnecessary re-renders
		const MemoizedScrollComponent = React.useMemo(() => {
			return ScrollComponentToUse;
		}, [ScrollComponentToUse]);

		return (
			<LinearGradient
				colors={colors}
				style={[styles.rootContainer, { paddingTop: insets.top }]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
			>
				{/* <BlurView intensity={20} style={{ flex: 1 }} tint="dark"> */}
				<ThemedView style={styles.dragHandleContainer}>
					<ThemedView style={styles.dragHandle} />
				</ThemedView>

				<MemoizedScrollComponent style={styles.scrollView} showsVerticalScrollIndicator={false}>
					<ThemedView style={styles.container}>
						<SongInfo />

						<ThemedView style={styles.controls}>
							<SongProgressBar />
							<TimeDisplay />
							<PlaybackControls />
							<ExtraControls />
						</ThemedView>
					</ThemedView>
				</MemoizedScrollComponent>
				{/* </BlurView> */}
			</LinearGradient>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison to prevent re-renders when only scrollComponent changes
		// This is important because the scrollComponent is recreated on every render in the parent
		return prevProps.scrollComponent === nextProps.scrollComponent;
	},
);

const styles = StyleSheet.create({
	rootContainer: {
		flex: 1,
		height: '100%',
		width: '100%',
		borderTopLeftRadius: 40,
		borderTopRightRadius: 40,
	},
	dragHandleContainer: {
		paddingBottom: 14,
	},
	dragHandle: {
		width: 40,
		height: 5,
		backgroundColor: 'rgba(255, 255, 255, 0.445)',
		borderRadius: 5,
		alignSelf: 'center',
		marginTop: 10,
	},
	container: {
		flex: 1,
		alignItems: 'center',
		padding: 20,
		paddingTop: 30,
		backgroundColor: 'transparent',
		justifyContent: 'space-between',
	},
	controls: {
		width: '100%',
		backgroundColor: 'transparent',
		flex: 1,
		justifyContent: 'space-between',
	},
	scrollView: {
		flex: 1,
		width: '100%',
	},
	lyricsContainer: {
		paddingHorizontal: 20,
		paddingVertical: 30,
		width: '100%',
		alignItems: 'center',
	},
	lyricsText: {
		color: '#fff',
		fontSize: 16,
		lineHeight: 24,
		textAlign: 'center',
		opacity: 0.8,
		marginVertical: 2,
	},
	lyricsSpacing: {
		marginVertical: 10,
	},
});
