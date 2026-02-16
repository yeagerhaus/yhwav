import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet } from 'react-native';
import { Div, DynamicItem, Main, Text } from '@/components';
import { Colors } from '@/constants/styles';
import { useArtists } from '@/hooks/useArtists';
import type { Artist } from '@/types';

export default function ArtistsScreen() {
	const router = useRouter();
	const { artists } = useArtists();

	const sorted = useMemo(() => [...artists].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [artists]);

	const keyExtractor = useCallback((item: Artist) => item.key, []);

	const renderItem = useCallback(
		({ item }: { item: Artist }) => <DynamicItem item={item} type='artist' />,
		[],
	);

	const listHeaderComponent = useMemo(
		() => (
			<Div transparent style={{ paddingTop: 64, marginBottom: 16 }}>
				<Text type='h1'>Artists</Text>
			</Div>
		),
		[],
	);

	const listEmptyComponent = useMemo(
		() => (
			<Div transparent style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
				<ActivityIndicator size='large' color={Colors.brandPrimary} />
			</Div>
		),
		[],
	);

	return (
		<Main scrollEnabled={false}>
			<FlatList
				data={sorted}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				ListEmptyComponent={listEmptyComponent}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={15}
				updateCellsBatchingPeriod={50}
				contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}


