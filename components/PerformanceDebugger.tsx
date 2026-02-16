/**
 * Performance Debugger Component
 * Shows real-time performance metrics in development
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { DefaultStyles } from '@/constants/styles';
import { performanceMonitor } from '@/utils/performance';
import { Div } from './Div';
import { Text } from './Text';

export function PerformanceDebugger() {
	const [visible, setVisible] = useState(false);
	const [metrics, setMetrics] = useState(performanceMonitor.getMetrics());

	useEffect(() => {
		if (!__DEV__ || !visible) return;

		const interval = setInterval(() => {
			setMetrics(performanceMonitor.getMetrics());
		}, 1000);

		return () => clearInterval(interval);
	}, [visible]);

	if (!__DEV__) return null;

	const slowest = performanceMonitor.getSlowestOperations(5);
	const avgPlaySound = performanceMonitor.getAverageDuration('playSound');
	const avgSkip = performanceMonitor.getAverageDuration('skipToNext');

	return (
		<>
			<Div useGlass style={styles.toggleButton}>
				<Pressable onPress={() => setVisible(!visible)}>
					<Text type='body' style={styles.toggleButtonText}>{'</>'} Debug</Text>
				</Pressable>
			</Div>

			{visible && (
				<Div useBlur style={styles.container}>
					<ScrollView style={styles.scrollView}>
						<Text type="h3" style={styles.title}>Performance Monitor</Text>

						<Div transparent style={styles.section}>
							<Text type="label" colorVariant="brand" style={styles.sectionTitle}>Key Metrics</Text>
							<Text type="bodySM" style={styles.metric}>playSound avg: {avgPlaySound.toFixed(2)}ms</Text>
							<Text type="bodySM" style={styles.metric}>skipToNext avg: {avgSkip.toFixed(2)}ms</Text>
							<Text type="bodySM" style={styles.metric}>Total metrics: {metrics.length}</Text>
						</Div>

						<Div transparent style={styles.section}>
							<Text type="label" colorVariant="brand" style={styles.sectionTitle}>Slowest Operations</Text>
							{slowest.map((m, i) => (
								<Text key={i} type="bodySM" style={styles.metric}>
									{m.name}: {m.duration.toFixed(2)}ms
								</Text>
							))}
						</Div>

						<Pressable
							style={[DefaultStyles.primaryButton, styles.debugButton]}
							onPress={() => performanceMonitor.logReport()}
						>
							<Text type="body" colorVariant="primaryInvert" style={DefaultStyles.center}>Log Full Report</Text>
						</Pressable>

						<Pressable
							style={[DefaultStyles.primaryButton, styles.debugButton]}
							onPress={() => {
								performanceMonitor.clear();
								setMetrics([]);
							}}
						>
							<Text type="body" colorVariant="primaryInvert" style={DefaultStyles.center}>Clear Metrics</Text>
						</Pressable>

						<Pressable
							style={[DefaultStyles.primaryButton, styles.debugButton]}
							onPress={() => {
								console.log(performanceMonitor.generateSummary());
								console.log('\n📋 Full JSON Export:\n', performanceMonitor.exportMetrics());
							}}
						>
							<Text type="body" colorVariant="primaryInvert" style={DefaultStyles.center}>Export for Analysis</Text>
						</Pressable>
					</ScrollView>
				</Div>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	toggleButton: {
		position: 'absolute',
		top: 64,
		right: 10,
		padding: 8,
		borderRadius: 8,
		zIndex: 9999,
	},
	toggleButtonText: {
		fontSize: 12,
		fontWeight: 'bold',
	},
	container: {
		position: 'absolute',
		top: 94,
		right: 10,
		width: 300,
		maxHeight: 400,
		backgroundColor: 'rgba(0, 0, 0, 0.7)',
		borderRadius: 8,
		padding: 12,
		zIndex: 9998,
	},
	scrollView: {
		maxHeight: 380,
	},
	title: {
		marginBottom: 12,
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
	debugButton: {
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 6,
		marginTop: 8,
	},
});
