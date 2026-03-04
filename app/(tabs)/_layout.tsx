import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';
import { Div } from '@/components/Div';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { useColors } from '@/hooks/useColors';

const TAB_ICONS = {
	'(library)': { default: 'music.note.square.stack', selected: 'music.note.square.stack.fill' },
	'(podcasts)': { default: 'apple.podcasts.pages.fill', selected: 'apple.podcasts.pages.fill' },
	'(settings)': { default: 'gearshape', selected: 'gearshape.fill' },
	search: { default: 'magnifyingglass', selected: 'magnifyingglass' },
} as const;

export default function TabLayout() {
	const colors = useColors();
	const { showPodcastsTab, showMusicTab, useBlurInsteadOfGlass } = useAppearanceStore();

	if (useBlurInsteadOfGlass) {
		return (
			<Tabs
				screenOptions={{
					headerShown: false,
					tabBarStyle: [styles.blurTabBar, { borderTopColor: colors.border }],
					tabBarActiveTintColor: colors.brand,
					tabBarInactiveTintColor: colors.text,
					tabBarBackground: () => <Div useGlass style={StyleSheet.absoluteFill} />,
					tabBarLabelStyle: { fontSize: 10 },
				}}
			>
				<Tabs.Screen
					name='(library)'
					options={{
						title: 'Library',
						tabBarIcon: ({ focused, color }) => (
							<SymbolView name={TAB_ICONS['(library)'][focused ? 'selected' : 'default']} size={24} tintColor={color} />
						),
						tabBarButton: showMusicTab ? undefined : () => null,
					}}
				/>
				<Tabs.Screen
					name='(podcasts)'
					options={{
						title: 'Podcasts',
						tabBarIcon: ({ focused, color }) => (
							<SymbolView name={TAB_ICONS['(podcasts)'][focused ? 'selected' : 'default']} size={24} tintColor={color} />
						),
						tabBarButton: showPodcastsTab ? undefined : () => null,
					}}
				/>
				<Tabs.Screen
					name='(settings)'
					options={{
						title: 'Settings',
						tabBarIcon: ({ focused, color }) => (
							<SymbolView name={TAB_ICONS['(settings)'][focused ? 'selected' : 'default']} size={24} tintColor={color} />
						),
					}}
				/>
				<Tabs.Screen
					name='search'
					options={{
						title: 'Search',
						tabBarIcon: ({ color }) => <SymbolView name={TAB_ICONS.search.default} size={24} tintColor={color} />,
					}}
				/>
			</Tabs>
		);
	}

	return (
		<NativeTabs minimizeBehavior='onScrollDown' tintColor={colors.brand}>
			<NativeTabs.Trigger name='(library)' hidden={!showMusicTab}>
				<Icon sf={{ default: 'music.note.square.stack', selected: 'music.note.square.stack.fill' }} selectedColor={colors.brand} />
				<Label>Library</Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name='(podcasts)' hidden={!showPodcastsTab}>
				<Icon sf={{ default: 'apple.podcasts.pages.fill', selected: 'apple.podcasts.pages.fill' }} selectedColor={colors.brand} />
				<Label>Podcasts</Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name='(settings)'>
				<Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} selectedColor={colors.brand} />
				<Label>Settings</Label>
			</NativeTabs.Trigger>
			{/* biome-ignore lint/a11y/useSemanticElements: NativeTabs.Trigger does not support semantic <search>; role=search is intentional for a11y */}
			<NativeTabs.Trigger name='search' role='search'>
				<Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} selectedColor={colors.brand} />
				<Label>Search</Label>
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}

const styles = StyleSheet.create({
	blurTabBar: {
		position: 'absolute',
		elevation: 0,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
});
