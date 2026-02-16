import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { Colors } from '@/constants/Colors';
import { useArtists } from '@/hooks/useArtists';
import type { Artist } from '@/types';

export default function ArtistsScreen() {
	const router = useRouter();
	const { artists } = useArtists();

	const sorted = useMemo(() => [...artists].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [artists]);

	const keyExtractor = useCallback((item: Artist) => item.key, []);

	const renderItem = useCallback(
		({ item }: { item: Artist }) => (
			<Pressable
				style={styles.item}
				onPress={() =>
					router.push({
						// @ts-expect-error
						pathname: '(library)/(artists)/[artistId]',
						params: { artistId: item.key },
					})
				}
			>
				{item.thumb ? (
					<Image source={{ uri: item.thumb }} style={styles.image} />
				) : (
					<Div style={styles.initialCircle}>
						<ThemedText style={styles.initialText}>{item.name.charAt(0).toUpperCase()}</ThemedText>
					</Div>
				)}
				<Div style={{ flex: 1 }}>
					<ThemedText style={styles.name}>{item.name}</ThemedText>
					{item.genres.length > 0 && <ThemedText style={styles.genres}>{item.genres.slice(0, 3).join(', ')}</ThemedText>}
				</Div>
			</Pressable>
		),
		[router],
	);

	const listHeaderComponent = useMemo(
		() => (
			<Div>
				<ThemedText style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16, paddingTop: 64 }}>Artists</ThemedText>
			</Div>
		),
		[],
	);

	const listEmptyComponent = useMemo(
		() => (
			<Div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
				<ActivityIndicator size='large' color={Colors.brand.primary} />
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

const styles = StyleSheet.create({
	item: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
	image: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ddd' },
	initialCircle: {
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: '#FA2D48',
		justifyContent: 'center',
		alignItems: 'center',
	},
	initialText: { fontSize: 20, fontWeight: 'bold', color: 'white' },
	name: { fontSize: 18, fontWeight: '500' },
	genres: { fontSize: 14, color: '#666' },
});
