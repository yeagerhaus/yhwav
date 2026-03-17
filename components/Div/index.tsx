import { BlurView, type BlurViewProps } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { ThemedView } from './ThemedView';

export interface GradientConfig {
	colors: string[];
	start?: { x: number; y: number };
	end?: { x: number; y: number };
	style?: StyleProp<ViewStyle>;
}

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
	gradients?: GradientConfig[];
}

function wrapWithGradients(children: ReactNode, gradients: GradientConfig[]): ReactNode {
	let wrapped = children;
	for (let i = gradients.length - 1; i >= 0; i--) {
		const g = gradients[i];
		wrapped = (
			<LinearGradient
				colors={g.colors as [string, string, ...string[]]}
				start={g.start ?? { x: 0, y: 0 }}
				end={g.end ?? { x: 1, y: 1 }}
				style={[gradientStyles.fill, g.style]}
			>
				{wrapped}
			</LinearGradient>
		);
	}
	return wrapped;
}

const gradientStyles = StyleSheet.create({
	fill: { flex: 1, width: '100%', height: '100%' },
});

export function Div({
	flex,
	display,
	children,
	useGlass,
	transparent,
	blurIntensity = 50,
	blurTint,
	style,
	gradients,
	...restProps
}: DivProps) {
	const colorScheme = useColorScheme() ?? 'dark';
	const { useBlurInsteadOfGlass } = useAppearanceStore();
	const systemTint: BlurViewProps['tint'] = colorScheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight';

	const showGradient = gradients?.length && !!useBlurInsteadOfGlass;
	const inner = showGradient ? wrapWithGradients(children, gradients!) : children;

	if (useGlass) {
		if (useBlurInsteadOfGlass) {
			return (
				<BlurView intensity={blurIntensity} tint={blurTint ?? systemTint} style={[style, { overflow: 'hidden' }]} {...restProps}>
					{inner}
				</BlurView>
			);
		}
		return (
			<GlassView style={style} {...restProps} glassEffectStyle='regular' colorScheme='auto'>
				{inner}
			</GlassView>
		);
	}
	if (transparent) {
		return (
			<View style={style} {...restProps}>
				{inner}
			</View>
		);
	}
	return (
		<ThemedView style={style} {...restProps}>
			{inner}
		</ThemedView>
	);
}
