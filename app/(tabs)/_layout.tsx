import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS } from 'react-native';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { useColors } from '@/hooks/useColors';

export default function TabLayout() {
	const colors = useColors();
	const showPodcastsTab = useAppearanceStore((s) => s.showPodcastsTab);

	return (
		<NativeTabs
			minimizeBehavior='onScrollDown'
			labelStyle={{
				// For the text color
				color: DynamicColorIOS({
					dark: 'white',
					light: 'black',
				}),
			}}
		>
			<NativeTabs.Trigger name='(library)'>
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
