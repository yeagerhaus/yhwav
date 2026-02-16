import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
	lightColor?: string;
	darkColor?: string;
	type?: 'body' | 'bodySM' | 'bodyXS' | 'label' | 'link' | 'linkSM' | 'h1' | 'h2' | 'h3' | 'h4' | 'title' | 'subtitle' | 'defaultSemiBold';
};

const DEFAULT_TYPOGRAPHY = StyleSheet.create({
	h1: {
		fontSize: 36,
		fontWeight: 700,
		lineHeight: 54,
		letterSpacing: 0.4,
	},
	h2: {
		fontSize: 24,
		fontWeight: 700,
		lineHeight: 36,
		letterSpacing: 0.4,
	},
	h3: {
		fontSize: 16,
		fontWeight: 700,
		lineHeight: 24,
		letterSpacing: 0.4,
	},
	h4: {
		fontSize: 12,
		fontWeight: 700,
		lineHeight: 18,
		letterSpacing: 1,
	},
	body: {
		fontSize: 16,
		fontWeight: 400,
		lineHeight: 24,
	},
	bodySM: {},
	bodyXS: {
		fontSize: 10,
		fontWeight: 400,
		lineHeight: 12,
	},
	label: {
		fontSize: 14,
		fontWeight: 700,
		lineHeight: 20,
		letterSpacing: 0.4,
	},
	link: {
		fontSize: 14,
		fontWeight: 700,
		lineHeight: 18,
		letterSpacing: 0.4,
	},
	linkSM: {
		fontSize: 13,
		fontWeight: 700,
		lineHeight: 16,
		letterSpacing: 0.4,
	},
	title: {
		fontSize: 24,
		fontWeight: 700,
		lineHeight: 36,
	},
	subtitle: {
		fontSize: 14,
		fontWeight: 400,
		lineHeight: 20,
	},
	defaultSemiBold: {
		fontSize: 16,
		fontWeight: 600,
		lineHeight: 24,
	},
});

export function ThemedText({ style, lightColor, darkColor, type = 'body', ...rest }: ThemedTextProps) {
	const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

	return <Text style={[{ color }, DEFAULT_TYPOGRAPHY[type], style]} {...rest} />;
}
