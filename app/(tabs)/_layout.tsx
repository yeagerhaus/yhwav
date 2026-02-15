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
			<NativeTabs.Trigger name='index'>
				<Label>Home</Label>
				<Icon sf={{ default: 'music.note.house', selected: 'music.note.house.fill' }} selectedColor={Colors.brand.primary} />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name='(library)'>
				<Label>Library</Label>
				<Icon
					// @ts-ignore biome-ignore lint/suspicious/noExplicitAny: <these are valid icons, just not typed>
					sf={{ default: 'music.note.square.stack', selected: 'music.note.square.stack.fill' }}
					selectedColor={Colors.brand.primary}
				/>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name='settings'>
				<Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} selectedColor={Colors.brand.primary} />
				<Label>Settings</Label>
			</NativeTabs.Trigger>

			// biome-ignore lint/a11y/useSemanticElements: role=search is intentional for a11y in native tab bar
			<NativeTabs.Trigger name='search' role='search'>
				<Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} selectedColor={Colors.brand.primary} />
				<Label>Search</Label>
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
