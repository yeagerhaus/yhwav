import { BlurView, type BlurViewProps } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { ThemedView } from './ThemedView';

export interface DivProps extends ViewProps {
	flex?: number;
	flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
	alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
	justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
	gap?: number;
	style?: StyleProp<ViewStyle>;
	useGlass?: boolean;
	useBlur?: boolean;
	transparent?: boolean;
	blurIntensity?: number;
	blurTint?: BlurViewProps['tint'];
	lightColor?: string;
	darkColor?: string;
}

export function Div({
	flex,
	flexDirection,
	alignItems,
	justifyContent,
	gap,
	children,
	useGlass,
	useBlur,
	transparent,
	blurIntensity,
	blurTint,
	style,
	lightColor,
	darkColor,
	...otherProps
}: DivProps) {
	if (useBlur) {
		return (
			<BlurView style={style} intensity={blurIntensity} tint={blurTint}>
				{children}
			</BlurView>
		);
	}
	if (useGlass) {
		return (
			<GlassView style={style} glassEffectStyle='clear' tintColor='light'>
				{children}
			</GlassView>
		);
	}
	if (transparent) {
		return (
			<View style={style} {...otherProps}>
				{children}
			</View>
		);
	}
	return (
		<ThemedView style={style} lightColor={lightColor} darkColor={darkColor} {...otherProps}>
			{children}
		</ThemedView>
	);
}
