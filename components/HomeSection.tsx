import { FlatList, StyleSheet, Text } from 'react-native';

interface HomeSectionProps<T> {
	title: string;
	data: T[];
	renderItem: (item: T) => React.ReactElement;
	keyExtractor: (item: T) => string;
}

export function HomeSection<T>({ title, data, renderItem, keyExtractor }: HomeSectionProps<T>) {
	if (data.length === 0) return null;

	return (
		<>
			<Text style={styles.title}>{title}</Text>
			<FlatList
				horizontal
				data={data}
				renderItem={({ item }) => renderItem(item)}
				keyExtractor={keyExtractor}
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.list}
			/>
		</>
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
