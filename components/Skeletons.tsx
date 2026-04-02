import { Dimensions, StyleSheet, View } from 'react-native';
import { Skeleton, SkeletonList } from './SkeletonCard';

const screenWidth = Dimensions.get('window').width;
const gridItemSize = screenWidth / 2 - 24;

interface SkeletonGridItemProps {
	size?: number;
}

export function SkeletonGridItem({ size }: SkeletonGridItemProps) {
	const s = size ?? gridItemSize;
	return (
		<View style={[styles.gridItem, { width: s }]}>
			<Skeleton width={s} height={s} borderRadius={8} />
			<View style={{ marginTop: 8, gap: 4, alignItems: 'center' }}>
				<Skeleton width={s * 0.7} height={14} borderRadius={4} />
				<Skeleton width={s * 0.5} height={12} borderRadius={4} />
			</View>
		</View>
	);
}

export function SkeletonSongRow() {
	return (
		<View style={styles.songRow}>
			<Skeleton width={50} height={50} borderRadius={4} />
			<View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
				<Skeleton width='70%' height={15} borderRadius={4} />
				<Skeleton width='45%' height={13} borderRadius={4} />
			</View>
		</View>
	);
}

export function SkeletonTrackRow() {
	return (
		<View style={styles.trackRow}>
			<Skeleton width={20} height={20} borderRadius={10} />
			<View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
				<Skeleton width='65%' height={15} borderRadius={4} />
				<Skeleton width='40%' height={13} borderRadius={4} />
			</View>
		</View>
	);
}

export function SkeletonArtistRow() {
	return (
		<View style={styles.artistRow}>
			<Skeleton width={50} height={50} borderRadius={25} />
			<View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
				<Skeleton width='55%' height={16} borderRadius={4} />
				<Skeleton width='35%' height={13} borderRadius={4} />
			</View>
		</View>
	);
}

export function SkeletonEpisodeRow() {
	return (
		<View style={styles.episodeRow}>
			<Skeleton width='80%' height={16} borderRadius={4} />
			<Skeleton width='100%' height={12} borderRadius={4} />
			<Skeleton width='60%' height={12} borderRadius={4} />
			<Skeleton width={70} height={32} borderRadius={16} />
		</View>
	);
}

export function SkeletonBanner() {
	return <Skeleton width='100%' height={200} borderRadius={8} />;
}

export { SkeletonList };

const styles = StyleSheet.create({
	gridItem: {
		alignItems: 'center',
		marginBottom: 24,
	},
	songRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 12,
	},
	trackRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 12,
		paddingVertical: 4,
	},
	artistRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 16,
		gap: 12,
	},
	episodeRow: {
		gap: 8,
		marginBottom: 6,
		paddingBottom: 8,
	},
});
