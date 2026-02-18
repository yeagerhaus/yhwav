import { StyleSheet, Switch } from 'react-native';
import { Div, Text } from '@/components';
import { Main } from '@/components/Main';
import { Colors, DefaultStyles } from '@/constants/styles';
import { useDevSettingsStore } from '@/hooks/useDevSettingsStore';
import { hexWithOpacity } from '@/utils/styles';

export default function DeveloperScreen() {
	const showPerformanceDebugger = useDevSettingsStore((state) => state.showPerformanceDebugger);
	const setShowPerformanceDebugger = useDevSettingsStore((state) => state.setShowPerformanceDebugger);

	return (
		<Main style={{ paddingHorizontal: 16, paddingTop: 100 }}>
			<Div transparent>
				<Text type='h1' style={{ marginBottom: 16 }}>
					Developer
				</Text>
			</Div>

			<Div style={[DefaultStyles.section, styles.section]} transparent>
				<Div style={styles.switchRow} transparent>
					<Text type='body'>Show performance debugger</Text>
					<Switch
						value={showPerformanceDebugger}
						onValueChange={setShowPerformanceDebugger}
						trackColor={{ false: Colors.surfaceDark, true: hexWithOpacity(Colors.brandPrimary, 0.5) }}
						thumbColor={showPerformanceDebugger ? Colors.brandPrimary : Colors.textMuted}
					/>
				</Div>
			</Div>
		</Main>
	);
}

const styles = StyleSheet.create({
	section: {
		marginTop: 8,
	},
	switchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 8,
	},
});
