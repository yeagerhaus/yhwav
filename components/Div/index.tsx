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
	showGradients?: boolean;
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

function GlassDiv({
	children,
	blurIntensity = 50,
	blurTint,
	style,
	gradients,
	showGradients,
	...restProps
}: Omit<DivProps, 'transparent' | 'useGlass'>) {
	const colorScheme = useColorScheme() ?? 'dark';
	const { useBlurInsteadOfGlass } = useAppearanceStore();
	const systemTint: BlurViewProps['tint'] = colorScheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight';

	const showGradient = gradients?.length && (!!useBlurInsteadOfGlass || showGradients);
	const inner = showGradient ? wrapWithGradients(children, gradients!) : children;

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

export function Div({ useGlass, transparent, children, gradients, showGradients, ...rest }: DivProps) {
	if (transparent) {
		const inner = gradients?.length && showGradients ? wrapWithGradients(children, gradients) : children;
		return (
			<View style={rest.style} {...rest}>
				{inner}
			</View>
		);
	}

	if (useGlass) {
		return (
			<GlassDiv gradients={gradients} showGradients={showGradients} {...rest}>
				{children}
			</GlassDiv>
		);
	}

	return (
		<ThemedView style={rest.style} {...rest}>
			{children}
		</ThemedView>
	);
}
