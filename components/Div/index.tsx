import { BlurView, type BlurViewProps } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { useColorScheme, View } from 'react-native';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { ThemedView } from './ThemedView';

export interface DivProps extends ViewProps {
	flex?: number;
	display?: 'flex' | 'none';
	flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
	alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
	justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
	gap?: number;
	style?: StyleProp<ViewStyle>;
	useGlass?: boolean;
	transparent?: boolean;
	blurIntensity?: number;
	blurTint?: BlurViewProps['tint'];
	lightColor?: string;
	darkColor?: string;
}

export function Div({ flex, display, children, useGlass, transparent, blurIntensity = 50, blurTint, style, ...restProps }: DivProps) {
	const colorScheme = useColorScheme() ?? 'dark';
	const { useBlurInsteadOfGlass } = useAppearanceStore();
	const systemTint: BlurViewProps['tint'] = colorScheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight';

	if (useGlass) {
		if (useBlurInsteadOfGlass) {
			return (
				<BlurView intensity={blurIntensity} tint={blurTint ?? systemTint} style={[style, { overflow: 'hidden' }]} {...restProps}>
					{children}
				</BlurView>
			);
		}
		return (
			<GlassView style={style} {...restProps} glassEffectStyle='regular' colorScheme='auto'>
				{children}
			</GlassView>
		);
	}
	if (transparent) {
		return (
			<View style={style} {...restProps}>
				{children}
			</View>
		);
	}
	return (
		<ThemedView style={style} {...restProps}>
			{children}
		</ThemedView>
	);
}
