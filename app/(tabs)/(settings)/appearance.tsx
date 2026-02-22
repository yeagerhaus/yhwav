import { StyleSheet, Switch } from 'react-native';
import { Div, Text } from '@/components';
import { Main } from '@/components/Main';
import { Colors, DefaultStyles } from '@/constants/styles';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { hexWithOpacity } from '@/utils/styles';

function SwitchRow({
	label,
	description,
	value,
	onValueChange,
}: {
	label: string;
	description?: string;
	value: boolean;
	onValueChange: (v: boolean) => void;
}) {
	return (
		<Div transparent style={styles.switchRow}>
			<Div transparent style={{ flex: 1, marginRight: 12 }}>
				<Text type='body'>{label}</Text>
				{description && (
					<Text type='bodyXS' colorVariant='muted' style={{ marginTop: 2 }}>
						{description}
					</Text>
				)}
			</Div>
			<Switch
				value={value}
				onValueChange={onValueChange}
				trackColor={{ false: Colors.surfaceDark, true: hexWithOpacity(Colors.brandPrimary, 0.5) }}
				thumbColor={value ? Colors.brandPrimary : Colors.textMuted}
			/>
		</Div>
	);
}

export default function AppearanceScreen() {
	const { showPodcastsTab, setShowPodcastsTab } = useAppearanceStore();

	return (
		<Main style={{ paddingHorizontal: 16 }}>
			<Div transparent>
				<Text type='h1' style={{ marginBottom: 16 }}>
					Appearance
				</Text>
			</Div>

			<Div transparent style={DefaultStyles.section}>
				<Text type='h3' style={DefaultStyles.sectionTitle}>
					Tabs
				</Text>

				<SwitchRow
					label='Show Podcasts Tab'
					description='Toggle the Podcasts tab in the bottom navigation bar.'
					value={showPodcastsTab}
					onValueChange={setShowPodcastsTab}
				/>
			</Div>
		</Main>
	);
}

const styles = StyleSheet.create({
	switchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 8,
	},
});
