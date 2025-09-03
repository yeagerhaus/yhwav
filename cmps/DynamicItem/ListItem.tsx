import { Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/cmps/ThemedText';
import { ThemedView } from '@/cmps/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ListItem({ item, onPress }: { item: any; onPress: () => void }) {
	const colorScheme = useColorScheme();

	return (
		<Pressable onPress={onPress}>
			<ThemedView
				style={{
					flex: 1,
					borderBottomWidth: StyleSheet.hairlineWidth,
					paddingVertical: 14,
					borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353',
				}}
			>
				<ThemedView style={{ flex: 1 }}>
					<ThemedText type='defaultSemiBold' numberOfLines={1} style={{ fontSize: 24, fontWeight: '600' }}>
						{item.title}
					</ThemedText>
				</ThemedView>
			</ThemedView>
		</Pressable>
	);
}
