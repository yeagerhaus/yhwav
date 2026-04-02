import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Div, Text } from '@/components';
import { useColors } from '@/hooks/useColors';
import { usePodcastStore } from '@/hooks/usePodcastStore';
import { type ITunesPodcastResult, searchPodcasts } from '@/utils/itunes-search';

const DEBOUNCE_MS = 400;

export default function PodcastSearchScreen() {
	const colors = useColors();
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<ITunesPodcastResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);
	const [addingId, setAddingId] = useState<number | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inputRef = useRef<TextInput>(null);

	const { addFeed, feeds } = usePodcastStore();

	useEffect(() => {
		setTimeout(() => inputRef.current?.focus(), 100);
	}, []);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);

		if (!query.trim()) {
			setResults([]);
			setSearched(false);
			return;
		}

		debounceRef.current = setTimeout(async () => {
			setLoading(true);
			try {
				const data = await searchPodcasts(query);
				setResults(data);
			} catch {
				setResults([]);
			} finally {
				setLoading(false);
				setSearched(true);
			}
		}, DEBOUNCE_MS);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query]);

	const isAlreadyAdded = useCallback((feedUrl: string) => feeds.some((f) => f.url === feedUrl), [feeds]);

	const handleAdd = useCallback(
		async (item: ITunesPodcastResult) => {
			if (isAlreadyAdded(item.feedUrl)) return;
			setAddingId(item.trackId);
			try {
				await addFeed(item.feedUrl);
			} catch {
				Alert.alert('Error', 'Failed to add podcast. The feed may be unavailable.');
			} finally {
				setAddingId(null);
			}
		},
		[addFeed, isAlreadyAdded],
	);

	const renderItem = useCallback(
		({ item }: { item: ITunesPodcastResult }) => {
			const added = isAlreadyAdded(item.feedUrl);
			const isAdding = addingId === item.trackId;

			return (
				<Pressable style={styles.resultRow} onPress={() => handleAdd(item)} disabled={added || isAdding}>
					<Image source={{ uri: item.artworkUrl100 }} style={styles.artwork} />
					<Div transparent style={styles.resultInfo}>
						<Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
							{item.trackName}
						</Text>
						<Text style={[styles.resultArtist, { color: colors.textMuted }]} numberOfLines={1}>
							{item.artistName}
						</Text>
						{item.genres.length > 0 && (
							<Text style={[styles.resultGenre, { color: colors.textMuted }]} numberOfLines={1}>
								{item.genres.slice(0, 2).join(', ')}
							</Text>
						)}
					</Div>
					<Div transparent style={styles.addButtonContainer}>
						{isAdding ? (
							<ActivityIndicator size='small' color={colors.brand} />
						) : added ? (
							<SymbolView name='checkmark.circle.fill' size={24} tintColor={colors.success} />
						) : (
							<SymbolView name='plus.circle' size={24} tintColor={colors.brand} />
						)}
					</Div>
				</Pressable>
			);
		},
		[addingId, handleAdd, isAlreadyAdded, colors.text],
	);

	const keyExtractor = useCallback((item: ITunesPodcastResult) => String(item.trackId), []);

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
			<Div transparent style={styles.header}>
				<Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
					<SymbolView name='chevron.left' size={20} tintColor={colors.brand} />
				</Pressable>
				<Text style={[styles.headerTitle, { color: colors.text }]}>Add Podcast</Text>
				<Div transparent style={styles.backButton} />
			</Div>

			<Div transparent style={styles.searchRow}>
				<Div transparent style={[styles.searchInputContainer, colors.background === '#080808' && styles.searchInputContainerDark]}>
					<SymbolView name='magnifyingglass' size={16} tintColor={colors.textMuted} />
					<TextInput
						ref={inputRef}
						style={[styles.searchInput, { color: colors.text }]}
						placeholder='Search podcasts...'
						placeholderTextColor={colors.textMuted}
						value={query}
						onChangeText={setQuery}
						autoCapitalize='none'
						autoCorrect={false}
						returnKeyType='search'
					/>
					{query.length > 0 && (
						<Pressable onPress={() => setQuery('')} hitSlop={8}>
							<SymbolView name='xmark.circle.fill' size={16} tintColor={colors.textMuted} />
						</Pressable>
					)}
				</Div>
			</Div>

			{loading && !searched ? (
				<Div transparent style={styles.centered}>
					<ActivityIndicator color={colors.brand} />
				</Div>
			) : searched && results.length === 0 ? (
				<Div transparent style={styles.centered}>
					<Text style={[styles.emptyText, { color: colors.textMuted }]}>No podcasts found for "{query}"</Text>
				</Div>
			) : !searched ? (
				<Div transparent style={styles.centered}>
					<SymbolView name='mic.fill' size={48} tintColor={colors.textMuted} type='hierarchical' />
					<Text style={[styles.emptyText, { color: colors.textMuted }]}>Search for a podcast by name</Text>
				</Div>
			) : (
				<FlashList
					data={results}
					keyExtractor={keyExtractor}
					renderItem={renderItem}
					contentContainerStyle={styles.listContent}
					keyboardDismissMode='on-drag'
					onScrollBeginDrag={() => Keyboard.dismiss()}
					ListFooterComponent={loading ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.brand} /> : null}
				/>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	backButton: {
		width: 32,
		alignItems: 'center',
	},
	headerTitle: {
		fontSize: 17,
		fontWeight: '600',
	},
	searchRow: {
		paddingHorizontal: 16,
		paddingBottom: 12,
	},
	searchInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		borderRadius: 10,
		paddingHorizontal: 12,
		gap: 8,
	},
	searchInputContainerDark: {
		backgroundColor: 'rgba(255, 255, 255, 0.08)',
	},
	searchInput: {
		flex: 1,
		fontSize: 16,
		paddingVertical: 10,
	},
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
	},
	emptyText: {
		fontSize: 15,
	},
	listContent: {
		paddingHorizontal: 16,
		paddingBottom: 100,
	},
	resultRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 10,
	},
	artwork: {
		width: 56,
		height: 56,
		borderRadius: 8,
		backgroundColor: '#333',
	},
	resultInfo: {
		flex: 1,
		gap: 2,
	},
	resultTitle: {
		fontSize: 15,
		fontWeight: '600',
	},
	resultArtist: {
		fontSize: 13,
	},
	resultGenre: {
		fontSize: 11,
		opacity: 0.7,
	},
	addButtonContainer: {
		width: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
