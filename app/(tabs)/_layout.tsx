import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS } from 'react-native';
import { Colors } from '@/constants';

export default function TabLayout() {
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
				<Icon
					// @ts-expect-error <these are valid icons, just not typed>
					sf={{ default: 'music.note.square.stack', selected: 'music.note.square.stack.fill' }}
					selectedColor={Colors.brandPrimary}
				/>
				<Label>Library</Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name='(podcasts)'>
				<Icon
					// @ts-expect-error <these are valid icons, just not typed>
					sf={{ default: 'apple.podcasts.pages.fill', selected: 'apple.podcasts.pages.fill' }}
					selectedColor={Colors.brandPrimary}
				/>
				<Label>Podcasts</Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name='settings'>
				<Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} selectedColor={Colors.brandPrimary} />
				<Label>Settings</Label>
			</NativeTabs.Trigger>

			{/* biome-ignore lint/a11y/useSemanticElements: NativeTabs.Trigger does not support semantic <search>; role=search is intentional for a11y */}
			<NativeTabs.Trigger name='search' role='search'>
				<Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} selectedColor={Colors.brandPrimary} />
				<Label>Search</Label>
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
