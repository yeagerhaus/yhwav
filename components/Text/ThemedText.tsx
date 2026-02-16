import { StyleSheet, Text, type TextProps } from 'react-native';

import { DefaultStyles, DefaultTypography } from '@/constants/styles';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ColorVariant = 'primary' | 'primaryInvert' | 'secondary' | 'muted' | 'brand' | 'danger' | 'link';

export type ThemedTextProps = TextProps & {
	lightColor?: string;
	darkColor?: string;
	type?: keyof typeof DefaultTypography;
	colorVariant?: ColorVariant;
};

const COLOR_VARIANT_STYLE: Record<ColorVariant, keyof typeof DefaultStyles> = {
	primary: 'textPrimary',
	primaryInvert: 'textPrimaryInvert',
	secondary: 'textSecondary',
	muted: 'textMuted',
	brand: 'textBrand',
	danger: 'textDanger',
	link: 'link',
};

export function ThemedText({
	style,
	lightColor,
	darkColor,
	type = 'body',
	colorVariant,
	...rest
}: ThemedTextProps) {
	const themeColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
	const colorStyle = colorVariant ? DefaultStyles[COLOR_VARIANT_STYLE[colorVariant]] : { color: themeColor };
	const typographyStyle = DefaultTypography[type] ?? DefaultTypography.body;

	return (
		<Text
			style={[colorStyle, typographyStyle, style]}
			{...rest}
		/>
	);
}
