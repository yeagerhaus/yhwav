import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/cmps/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ListItem({ item, onPress }: { item: any; onPress: () => void }) {
	const colorScheme = useColorScheme();

	return (
		<Pressable onPress={onPress}>
			<View
				style={{
					flex: 1,
					borderBottomWidth: StyleSheet.hairlineWidth,
					paddingVertical: 14,
					borderBottomColor: colorScheme === 'light' ? '#ababab' : '#535353',
				}}
			>
				<View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
					{item.icon && <SymbolView name={item.icon} style={{ width: 20, height: 20, margin: 5 }} type='hierarchical' />}
					<ThemedText type='defaultSemiBold' numberOfLines={1} style={{ fontSize: 24, fontWeight: '600' }}>
						{item.title}
					</ThemedText>
				</View>
			</View>
		</Pressable>
	);
}
