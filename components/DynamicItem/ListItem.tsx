import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Text } from '@/components/Text';
import { Colors } from '@/constants/styles';
import { Div } from '../Div';

export default function ListItem({ item, onPress }: { item: any; onPress: () => void }) {
	const colorScheme = useColorScheme();

	return (
		<Pressable onPress={onPress}>
			<Div
				transparent
				style={{
					flex: 1,
					borderBottomWidth: StyleSheet.hairlineWidth,
					paddingVertical: 14,
					borderBottomColor: colorScheme === 'light' ? Colors.listDividerLight : Colors.listDividerDark,
				}}
			>
				<Div transparent style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
					{item.icon && (
						<SymbolView
							name={item.icon}
							style={{ width: 20, height: 20, margin: 5 }}
							type='hierarchical'
							tintColor={Colors.brandPrimary}
						/>
					)}
					<Text type='defaultSemiBold' numberOfLines={1} style={{ fontSize: 24, fontWeight: '600' }}>
						{item.title}
					</Text>
				</Div>
			</Div>
		</Pressable>
	);
}
