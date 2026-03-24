import React from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioStore } from '@/hooks/useAudioStore';
import { useColors } from '@/hooks/useColors';
import { useUltraBlurColors } from '@/hooks/useUltraBlurColors';
import type { GradientConfig } from '../Div';
import { Div } from '../Div';
import { ExtraControls } from '../Player/ExtraControls';
import { PlaybackControls } from '../Player/PlaybackControls';
import { QueueList } from '../Player/QueueList';
import { SongInfo } from '../Player/SongInfo';
import { SongProgressBar } from '../Player/SongProgressBar';
import { TimeDisplay } from '../Player/TimeDisplay';

interface ExpandedPlayerProps {
	scrollComponent?: (props: any) => React.ReactElement;
	queueOpen?: boolean;
	onToggleQueue?: () => void;
}

export const ExpandedPlayer = React.memo(
	({ scrollComponent, queueOpen, onToggleQueue }: ExpandedPlayerProps) => {
		const ScrollComponentToUse = scrollComponent || ScrollView;
		const { colors: ultraBlur, hasColors } = useUltraBlurColors();
		const artworkBgColor = useAudioStore((state) => state.artworkBgColor);
		const currentSong = useAudioStore((state) => state.currentSong);
		const isPodcast = currentSong?.source === 'podcast';
		const insets = useSafeAreaInsets();

		// Fallback: single-color gradient using artworkBgColor
		const colors = useColors();
		const podcastFallbackColor = colors.background;
		const fallbackColor = isPodcast ? podcastFallbackColor : artworkBgColor || '#000000';

		const MemoizedScrollComponent = React.useMemo(() => {
			return ScrollComponentToUse;
		}, [ScrollComponentToUse]);

		const gradients: GradientConfig[] = [
			{
				colors: hasColors ? [ultraBlur.topLeft, ultraBlur.bottomRight] : [fallbackColor, fallbackColor],
				start: { x: 0, y: 0 },
				end: { x: 1, y: 1 },
				style: styles.rootContainer,
			},
			{
				colors: hasColors ? [`${ultraBlur.topRight}CC`, `${ultraBlur.bottomLeft}CC`] : ['transparent', 'transparent'],
				start: { x: 1, y: 0 },
				end: { x: 0, y: 1 },
				style: styles.rootContainer,
			},
		];

		const playerUI = (
			<Div transparent style={styles.container}>
				<SongInfo />

				<Div transparent style={styles.controls}>
					<SongProgressBar />
					<TimeDisplay />
					<PlaybackControls />
					<ExtraControls queueOpen={queueOpen} onToggleQueue={onToggleQueue} />
				</Div>
			</Div>
		);

		return (
			<Div style={[styles.rootContainer, { paddingTop: insets.top, zIndex: 1 }]} transparent showGradients gradients={gradients}>
				<Div style={styles.innerContainer} transparent>
					<Div transparent style={styles.dragHandleContainer}>
						<Div transparent style={styles.dragHandle} />
					</Div>

					{queueOpen ? (
						<Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={styles.flex1}>
							<QueueList headerComponent={playerUI} onToggleQueue={onToggleQueue} />
						</Animated.View>
					) : (
						<Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={styles.flex1}>
							<MemoizedScrollComponent style={styles.scrollView} showsVerticalScrollIndicator={false}>
								{playerUI}
							</MemoizedScrollComponent>
						</Animated.View>
					)}
				</Div>
			</Div>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.scrollComponent === nextProps.scrollComponent &&
			prevProps.queueOpen === nextProps.queueOpen &&
			prevProps.onToggleQueue === nextProps.onToggleQueue
		);
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
	innerContainer: {
		flex: 1,
		height: '100%',
		width: '100%',
		borderTopLeftRadius: 40,
		borderTopRightRadius: 40,
		zIndex: 1000,
	},
	flex1: {
		flex: 1,
	},
	dragHandleContainer: {
		paddingBottom: 14,
	},
	dragHandle: {
		width: 40,
		height: 5,
		backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
});
