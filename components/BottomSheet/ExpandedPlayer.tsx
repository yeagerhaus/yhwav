import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioStore } from '@/hooks/useAudioStore';
import { useUltraBlurColors } from '@/hooks/useUltraBlurColors';
import { Div } from '../Div';
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
		const { colors: ultraBlur, hasColors } = useUltraBlurColors();
		const artworkBgColor = useAudioStore((state) => state.artworkBgColor);

		const insets = useSafeAreaInsets();

		// Fallback: single-color gradient using artworkBgColor
		const fallbackColor = artworkBgColor || '#000000';

		const MemoizedScrollComponent = React.useMemo(() => {
			return ScrollComponentToUse;
		}, [ScrollComponentToUse]);

		return (
			<Div style={[styles.rootContainer, { paddingTop: insets.top, zIndex: 1 }]} transparent>
				{/* Layer 1: top-left → bottom-right diagonal */}
				<LinearGradient
					colors={hasColors ? [ultraBlur.topLeft, ultraBlur.bottomRight] : [fallbackColor, fallbackColor]}
					style={styles.rootContainer}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
				>
					{/* Layer 2: top-right → bottom-left diagonal, semi-transparent overlay */}
					<LinearGradient
						colors={hasColors ? [`${ultraBlur.topRight}CC`, `${ultraBlur.bottomLeft}CC`] : ['transparent', 'transparent']}
						style={styles.rootContainer}
						start={{ x: 1, y: 0 }}
						end={{ x: 0, y: 1 }}
					>
						<Div style={{ ...styles.rootContainer, zIndex: 1000 }} transparent>
							<Div transparent style={styles.dragHandleContainer}>
								<Div transparent style={styles.dragHandle} />
							</Div>

							<MemoizedScrollComponent style={styles.scrollView} showsVerticalScrollIndicator={false}>
								<Div transparent style={styles.container}>
									<SongInfo />

									<Div transparent style={styles.controls}>
										<SongProgressBar />
										<TimeDisplay />
										<PlaybackControls />
										<ExtraControls />
									</Div>
								</Div>
							</MemoizedScrollComponent>
						</Div>
					</LinearGradient>
				</LinearGradient>
			</Div>
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
