import { Text, type TextProps } from 'react-native';

import { DefaultTypography } from '@/constants/styles';
import { useColors } from '@/hooks/useColors';

export type ColorVariant = 'primary' | 'primaryInvert' | 'secondary' | 'muted' | 'brand' | 'danger' | 'link';

export type ThemedTextProps = TextProps & {
	lightColor?: string;
	darkColor?: string;
	type?: keyof typeof DefaultTypography;
	colorVariant?: ColorVariant;
};

export function ThemedText({ style, lightColor, darkColor, type = 'body', colorVariant, ...rest }: ThemedTextProps) {
	const colors = useColors();

	const variantMap: Record<ColorVariant, string> = {
		primary: colors.text,
		primaryInvert: colors.textInvert,
		secondary: colors.textSecondary,
		muted: colors.textMuted,
		brand: colors.brand,
		danger: colors.danger,
		link: colors.link,
	};

	const resolvedColor = colorVariant ? variantMap[colorVariant] : colors.text;
	const typographyStyle = DefaultTypography[type] ?? DefaultTypography.body;

	return <Text style={[{ color: resolvedColor }, typographyStyle, style]} {...rest} />;
}
