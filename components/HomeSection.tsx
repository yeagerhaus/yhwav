import { FlatList, type StyleProp, View, type ViewStyle } from 'react-native';
import { Div } from './Div';
import { SkeletonCard } from './SkeletonCard';
import { Text } from './Text';

const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3'];

interface HomeSectionProps<T> {
	title: string;
	data: T[];
	renderItem: (item: T) => React.ReactElement;
	keyExtractor: (item: T) => string;
	style?: StyleProp<ViewStyle>;
	isLoading?: boolean;
	itemSize?: number;
}

export function HomeSection<T>({ title, data, renderItem, keyExtractor, style, isLoading, itemSize = 175 }: HomeSectionProps<T>) {
	if (data.length === 0 && !isLoading) return null;

	return (
		<Div transparent style={style} display='flex' gap={16}>
			<Text type='h2' style={{ paddingHorizontal: 16 }}>
				{title}
			</Text>
			{data.length > 0 ? (
				<FlatList
					horizontal
					data={data}
					renderItem={({ item }) => renderItem(item)}
					keyExtractor={keyExtractor}
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
				/>
			) : (
				<View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12 }}>
					{SKELETON_KEYS.map((key) => (
						<SkeletonCard key={key} size={itemSize} />
					))}
				</View>
			)}
		</Div>
	);
}
