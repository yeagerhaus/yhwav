import { useRouter } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';
import { DynamicItem, ThemedText } from '@/components';
import { Div } from '@/components/Div';
import { Main } from '@/components/Main';
import { useLibraryStore } from '@/hooks/useLibraryStore';

const SECTIONS = [
	{ title: 'Playlists', icon: 'music.note.list', route: '/(tabs)/(library)/(playlists)' },
	{ title: 'Artists', icon: 'person.2.fill', route: '/(tabs)/(library)/(artists)' },
	{ title: 'Albums', icon: 'square.stack.3d.up.fill', route: '/(tabs)/(library)/(albums)' },
	{ title: 'Songs', icon: 'music.note', route: '/(tabs)/(library)/songs' },
];

export default function LibraryScreen() {
	const router = useRouter();
	const tracks = useLibraryStore((s) => s.tracks);

	return (
		<Main>
			<Div style={{ paddingHorizontal: 16, marginBottom: 16 }}>
				<ThemedText style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
					{Number(tracks.length).toLocaleString()} {tracks.length === 1 ? 'Song' : 'Songs'} in Library
				</ThemedText>
				<FlatList
					scrollEnabled={false}
					data={SECTIONS}
					keyExtractor={(item) => item.title}
					renderItem={({ item }) => (
						<DynamicItem item={item} type='list' onPress={() => router.push(item.route as any)} />
					)}
				/>
			</Div>
			<ThemedText style={styles.title}>Recent Plays</ThemedText>
			{/* <Div style={styles.categoriesContainer}></Div> */}
		</Main>
	);
}

const styles = StyleSheet.create({
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		marginHorizontal: 16,
		marginTop: 16,
	},
	container: {
		flex: 1,
		// backgroundColor: '#fff',
	},
	categoriesContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
		padding: 16,
	},
	categoryWrapper: {
		width: '48%',
	},
});
