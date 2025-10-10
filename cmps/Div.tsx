import { BlurView, type BlurViewProps } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { type StyleProp, View, type ViewStyle } from 'react-native';

interface DivProps {
	useGlass?: boolean;
	useBlur?: boolean;
	blurIntensity?: number;
	blurTint?: BlurViewProps['tint'];
	style?: StyleProp<ViewStyle>;
	children: React.ReactNode;
}

export function Div({ children, useGlass, useBlur, blurIntensity, blurTint, style }: DivProps) {
	if (useBlur) {
		return (
			<BlurView style={style} intensity={blurIntensity} tint={blurTint}>
				{children}
			</BlurView>
		);
	} else if (useGlass) {
		return (
			<GlassView style={style} glassEffectStyle='clear' tintColor='light'>
				{children}
			</GlassView>
		);
	} else {
		return <View style={style}>{children}</View>;
	}
}
