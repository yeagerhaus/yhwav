import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS } from 'react-native';
import { Colors } from '@/constants';

export const unstable_settings = {
	initialRouteName: 'home',
};

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
			<NativeTabs.Trigger name='home'>
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

			<NativeTabs.Trigger name='search' role='search'>
				<Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} selectedColor={Colors.brand.primary} />
				<Label>Search</Label>
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
