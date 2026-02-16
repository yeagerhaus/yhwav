import { BlurView, type BlurViewProps } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import type { ViewProps } from 'react-native';
import { ThemedView } from './ThemedView';

export interface DivProps extends ViewProps {
	useGlass?: boolean;
	useBlur?: boolean;
	blurIntensity?: number;
	blurTint?: BlurViewProps['tint'];
	lightColor?: string;
	darkColor?: string;
}

export function Div({
	children,
	useGlass,
	useBlur,
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
	return (
		<ThemedView style={style} lightColor={lightColor} darkColor={darkColor} {...otherProps}>
			{children}
		</ThemedView>
	);
}
