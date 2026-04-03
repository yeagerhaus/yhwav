import { FlatList, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
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
	onSeeAll?: () => void;
}

export function HomeSection<T>({ title, data, renderItem, keyExtractor, style, isLoading, itemSize = 175, onSeeAll }: HomeSectionProps<T>) {
	if (data.length === 0 && !isLoading) return null;

	return (
		<Div transparent style={style} display='flex' gap={16}>
			<Div transparent style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }}>
				<Text type='h2'>{title}</Text>
				{onSeeAll && (
					<Pressable onPress={onSeeAll}>
						<Text type='bodySM' colorVariant='brand'>
							See All
						</Text>
					</Pressable>
				)}
			</Div>
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
