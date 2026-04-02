import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Div, DynamicItem, Main, Text } from '@/components';
import { SkeletonArtistRow, SkeletonList } from '@/components/Skeletons';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { useOfflineFilteredLibrary } from '@/hooks/useOfflineFilteredLibrary';
import type { Artist } from '@/types';

export default function ArtistsScreen() {
	const _router = useRouter();
	const { artists } = useOfflineFilteredLibrary();
	const hasInitialized = useLibraryStore((s) => s.hasInitialized);

	const sorted = useMemo(() => [...artists].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [artists]);

	const keyExtractor = useCallback((item: Artist) => item.key, []);

	const renderItem = useCallback(({ item }: { item: Artist }) => <DynamicItem item={item} type='artist' />, []);

	const listHeaderComponent = useMemo(
		() => (
			<Div transparent style={{ paddingTop: 64, marginBottom: 16 }}>
				<Text type='h1'>Artists</Text>
			</Div>
		),
		[],
	);

	const listEmptyComponent = useMemo(
		() =>
			hasInitialized ? (
				<Div transparent style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
					<Text type='body' colorVariant='muted'>
						No artists found
					</Text>
				</Div>
			) : (
				<Div transparent style={{ paddingTop: 8 }}>
					<SkeletonList count={10}>
						<SkeletonArtistRow />
					</SkeletonList>
				</Div>
			),
		[hasInitialized],
	);

	return (
		<Main scrollEnabled={false}>
			<FlashList
				data={sorted}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
				ListHeaderComponent={listHeaderComponent}
				ListEmptyComponent={listEmptyComponent}
				contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
			/>
		</Main>
	);
}
