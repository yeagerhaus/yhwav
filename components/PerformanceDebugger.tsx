import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { DefaultStyles } from '@/constants/styles';
import { useThemedStyles } from '@/hooks/useColors';
import { performanceMonitor } from '@/utils/performance';
import { Div } from './Div';
import { Text } from './Text';

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

function getMemoryUsage(): { used: string; total: string; limit?: string } | null {
	try {
		const perf = global.performance as Performance & {
			memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
		};
		if (perf?.memory) {
			return {
				used: formatBytes(perf.memory.usedJSHeapSize),
				total: formatBytes(perf.memory.totalJSHeapSize),
				limit: formatBytes(perf.memory.jsHeapSizeLimit),
			};
		}
		if (typeof process !== 'undefined' && process.memoryUsage) {
			const mem = process.memoryUsage();
			return {
				used: formatBytes(mem.heapUsed),
				total: formatBytes(mem.heapTotal),
			};
		}
	} catch {
		// ignore
	}
	return null;
}

export function PerformanceDebugger() {
	const themed = useThemedStyles();
	const [metrics, setMetrics] = useState(performanceMonitor.getMetrics());
	const [memory, setMemory] = useState<ReturnType<typeof getMemoryUsage>>(getMemoryUsage());

	useEffect(() => {
		// if (!__DEV__) return;

		const interval = setInterval(() => {
			setMetrics(performanceMonitor.getMetrics());
			setMemory(getMemoryUsage());
		}, 1000);

		return () => clearInterval(interval);
	}, []);

	// if (!__DEV__) return null;

	const slowest = performanceMonitor.getSlowestOperations(5);
	const avgPlaySound = performanceMonitor.getAverageDuration('playSound');
	const avgSkip = performanceMonitor.getAverageDuration('skipToNext');

	return (
		<Div transparent style={styles.wrapper}>
			<Div transparent style={styles.section}>
				<Text type='label' colorVariant='brand' style={styles.sectionTitle}>
					Memory
				</Text>
				{memory ? (
					<>
						<Text type='bodySM' style={styles.metric}>
							Heap used: {memory.used}
						</Text>
						<Text type='bodySM' style={styles.metric}>
							Heap total: {memory.total}
						</Text>
						{memory.limit != null && (
							<Text type='bodySM' style={styles.metric}>
								Heap limit: {memory.limit}
							</Text>
						)}
					</>
				) : (
					<Text type='bodySM' style={styles.metric}>
						Unavailable (use Chrome debugger for heap stats)
					</Text>
				)}
			</Div>

			<Div transparent style={styles.section}>
				<Text type='label' colorVariant='brand' style={styles.sectionTitle}>
					Key Metrics
				</Text>
				<Text type='bodySM' style={styles.metric}>
					playSound avg: {avgPlaySound.toFixed(2)}ms
				</Text>
				<Text type='bodySM' style={styles.metric}>
					skipToNext avg: {avgSkip.toFixed(2)}ms
				</Text>
				<Text type='bodySM' style={styles.metric}>
					Total metrics: {metrics.length}
				</Text>
			</Div>

			<Div transparent style={styles.section}>
				<Text type='label' colorVariant='brand' style={styles.sectionTitle}>
					Slowest Operations
				</Text>
				{slowest.length > 0 ? (
					slowest.map((m, i) => (
						<Text key={i} type='bodySM' style={styles.metric}>
							{m.name}: {m.duration.toFixed(2)}ms
						</Text>
					))
				) : (
					<Text type='bodySM' style={styles.metric}>
						No operations recorded
					</Text>
				)}
			</Div>

			<Pressable style={[themed.primaryButton, styles.actionButton]} onPress={() => performanceMonitor.logReport()}>
				<Text type='body' colorVariant='primaryInvert' style={DefaultStyles.center}>
					Log Full Report
				</Text>
			</Pressable>

			<Pressable
				style={[themed.primaryButton, styles.actionButton]}
				onPress={() => {
					performanceMonitor.clear();
					setMetrics([]);
				}}
			>
				<Text type='body' colorVariant='primaryInvert' style={DefaultStyles.center}>
					Clear Metrics
				</Text>
			</Pressable>

			<Pressable
				style={[themed.primaryButton, styles.actionButton]}
				onPress={() => {
					console.log(performanceMonitor.generateSummary());
					console.log('\n📋 Full JSON Export:\n', performanceMonitor.exportMetrics());
				}}
			>
				<Text type='body' colorVariant='primaryInvert' style={DefaultStyles.center}>
					Export for Analysis
				</Text>
			</Pressable>
		</Div>
	);
}

const styles = StyleSheet.create({
	wrapper: {
		marginTop: 16,
	},
	section: {
		marginBottom: 16,
	},
	sectionTitle: {
		marginBottom: 8,
	},
	metric: {
		fontSize: 12,
		marginBottom: 4,
	},
	actionButton: {
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 6,
		marginTop: 8,
	},
});
