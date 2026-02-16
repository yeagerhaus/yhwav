import { FlatList, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { Div } from './Div';

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
		<Div style={style}>
			<Text style={styles.title}>{title}</Text>
			<FlatList
				horizontal
				data={data}
				renderItem={({ item }) => renderItem(item)}
				keyExtractor={keyExtractor}
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.list}
			/>
		</Div>
	);
}

const styles = StyleSheet.create({
	title: {
		fontSize: 22,
		fontWeight: 'bold',
		color: '#FFFFFF',
		paddingHorizontal: 16,
		marginTop: 24,
		marginBottom: 12,
	},
	list: {
		paddingHorizontal: 16,
		gap: 12,
	},
});
