import { FlatList, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Div } from './Div';
import { Text } from './Text';

interface HomeSectionProps<T> {
	title: string;
	data: T[];
	renderItem: (item: T) => React.ReactElement;
	keyExtractor: (item: T) => string;
	style?: StyleProp<ViewStyle>;
}

export function HomeSection<T>({ title, data, renderItem, keyExtractor, style }: HomeSectionProps<T>) {
	if (data.length === 0) return null;

	return (
		<Div transparent style={style} display='flex' gap={16}>
			<Text type='h2' style={{ paddingHorizontal: 16 }}>{title}</Text>
			<FlatList
				horizontal
				data={data}
				renderItem={({ item }) => renderItem(item)}
				keyExtractor={keyExtractor}
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
			/>
		</Div>
	);
}
