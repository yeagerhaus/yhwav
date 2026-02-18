import { BlurView, type BlurViewProps } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { View } from 'react-native';
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
	useBlur?: boolean;
	transparent?: boolean;
	blurIntensity?: number;
	blurTint?: BlurViewProps['tint'];
	lightColor?: string;
	darkColor?: string;
}

export function Div({ flex, display, children, useBlur, useGlass, transparent, ...props }: DivProps) {
	if (useBlur) {
		return <BlurView {...props}>{children}</BlurView>;
	}
	if (useGlass) {
		return (
			<GlassView {...props} glassEffectStyle='clear' tintColor='light'>
				{children}
			</GlassView>
		);
	}
	if (transparent) {
		return <View {...props}>{children}</View>;
	}
	return <ThemedView {...props}>{children}</ThemedView>;
}
