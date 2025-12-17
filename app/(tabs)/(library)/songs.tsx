import { useCallback, useMemo } from 'react';
import { FlatList } from 'react-native';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';

// Estimated item height for getItemLayout optimization
const ITEM_HEIGHT = 70;

export default function SongsScreen() {
	// Use selector to prevent unnecessary re-renders
	const tracks = useLibraryStore((s) => s.tracks);

	const songs = useMemo(() => {
		return [...tracks].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
	}, [tracks]);

	const renderItem = useCallback(
		({ item }: { item: typeof songs[0] }) => <DynamicItem item={item} type='song' queue={songs} />,
		[songs],
	);

	const getItemLayout = useCallback(
		(_: any, index: number) => ({
			length: ITEM_HEIGHT,
			offset: ITEM_HEIGHT * index,
			index,
		}),
		[],
	);

	const keyExtractor = useCallback((item: typeof songs[0]) => item.id.toString(), []);

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16 }}>
				<Div>
					<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16 }}>Songs</ThemedText>
				</Div>
				<FlatList
					data={songs}
					keyExtractor={keyExtractor}
					renderItem={renderItem}
					getItemLayout={getItemLayout}
					removeClippedSubviews={true}
					maxToRenderPerBatch={10}
					windowSize={10}
					initialNumToRender={15}
					updateCellsBatchingPeriod={50}
					contentContainerStyle={{ paddingBottom: 300 }}
				/>
			</Div>
		</Main>
	);
}
