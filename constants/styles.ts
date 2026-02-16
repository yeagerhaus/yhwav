import { StyleSheet } from 'react-native';

import type { BorderRadiusType, ButtonStyle, PaddingType } from '@/types';
import { isWeb } from './API';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

const Colors = {
	brand: '#6262F5',
	/** Primary brand color used for accents, tab bar, buttons, etc. */
	brandPrimary: '#7f62f5',
	// Theme colors for useThemeColor (light/dark). background = surfacePrimary (light) / surfaceInvert (dark).
	light: {
		text: '#11181C',
		background: '#ffffff', // surfacePrimary
		tint: tintColorLight,
		icon: '#687076',
		tabIconDefault: '#687076',
		tabIconSelected: tintColorLight,
	},
	dark: {
		text: '#ECEDEE',
		background: '#080808', // surfaceInvert (Colors.black)
		tint: tintColorDark,
		icon: '#9BA1A6',
		tabIconDefault: '#9BA1A6',
		tabIconSelected: tintColorDark,
	},
	info: '#006ded',
	success: '#0a803a',
	warning: '#c74800',
	danger: '#d93232',

	// Inverted colors for dark mode
	infoInvert: '#0095ff',
	successInvert: '#1ecc64',
	warningInvert: '#ff922e',
	dangerInvert: '#f85454',

	// Color palettes
	indigo100: '#efefff',
	indigo200: '#cdcdff',
	indigo300: '#ababff',
	indigo400: '#8888ff',
	indigo500: '#6262f5',
	indigo600: '#4c4cd3',
	indigo700: '#3838b1',
	indigo800: '#27278f',
	indigo900: '#1a1a6d',

	purple100: '#f2eeff',
	purple200: '#d5caff',
	purple300: '#b7a5ff',
	purple400: '#9a81ff',
	purple500: '#7a5af8',
	purple600: '#6144d6',
	purple700: '#4c32b4',
	purple800: '#382292',
	purple900: '#271570',

	blue100: '#e5f4ff',
	blue200: '#b7e1ff',
	blue300: '#8aceff',
	blue400: '#5cbbff',
	blue500: '#0095ff',
	blue600: '#0095ff',
	blue700: '#007dd6',
	blue800: '#006ded',
	blue900: '#004e85',

	green100: '#e9fcf1',
	green200: '#b7f7d2',
	green300: '#8af5b4',
	green400: '#32ee7d',
	green500: '#1ecc64',
	green600: '#0eaa4d',
	green700: '#0eaa4d',
	green800: '#038838',
	green900: '#006629',

	red100: '#ffeeee',
	red200: '#ffc8c8',
	red300: '#ffa2a2',
	red400: '#ff7c7c',
	red500: '#f85454',
	red600: '#d63f3f',
	red700: '#b42d2d',
	red800: '#921e1e',
	red900: '#701212',

	yellow100: '#fff9e7',
	yellow200: '#fff0bd',
	yellow300: '#ffe693',
	yellow400: '#ffdc69',
	yellow500: '#ffd23f',
	yellow600: '#fac515',
	yellow700: '#d1a102',
	yellow800: '#a88100',
	yellow900: '#806200',

	pink100: '#ffedf9',
	pink200: '#ffc4ed',
	pink300: '#ff9ce1',
	pink400: '#fd73d3',
	pink500: '#ee46bc',
	pink600: '#cc329e',
	pink700: '#aa2281',
	pink800: '#881465',
	pink900: '#660a4a',

	orange100: '#fff1e5',
	orange200: '#fcdcbd',
	orange300: '#ffc28a',
	orange400: '#ffaa5c',
	orange500: '#ff922e',
	orange600: '#ff7a00',
	orange700: '#d66700',
	orange800: '#ad5300',
	orange900: '#854000',

	// Grays and Blacks
	white: '#ffffff',
	gray100: '#fafbfc',
	gray200: '#e2e6ed',
	gray400: '#a2a6ae',
	gray600: '#626875',
	gray800: '#37383a',
	gray900: '#1f1f1f',
	black: '#080808',
};

const DefaultSharedComponents = {
	borderRadiusXS: 4,
	borderRadiusSM: 8,
	borderRadiusMD: 10,
	borderRadiusXL: 100,
	cardBorderColor: Colors.gray200,
	dropdownBackdrop: 'rgba(0, 0, 0, 0.3)',
	boxShadow: 'rgba(0, 0, 0, 0.15)',
	fontWeight: 400,
	fontSize: 16, // 1rem is roughly 16px
	lineHeight: 1.5,
	letterSpacing: 0.4,
	placeholderColor: 'rgba(0, 0, 0, 0.5)',
};

const DefaultTypography = StyleSheet.create({
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
});

const DefaultSizes = {
	gutterSize: 8,
	gutterSize2x: 16,
	gutterSize3x: 24,
	appNavWidth: 100,
};

const defaultButtonPadding: PaddingType = {
	top: 12,
	bottom: 12,
	left: 32,
	right: 32,
};

const defaultButtonBorderRadius: BorderRadiusType = {
	bottomLeft: 100,
	bottomRight: 100,
	topLeft: 100,
	topRight: 100,
};

export const defaultButtonStyles: ButtonStyle = {
	padding: defaultButtonPadding,
	borderRadius: defaultButtonBorderRadius,
	fontSize: 16,
	fontWeight: 700,
};

const DefaultStyles = StyleSheet.create({
	textPrimary: {
		color: Colors.black,
	},
	textPrimaryInvert: {
		color: Colors.white,
	},
	textSecondary: {
		color: Colors.gray600,
	},
	textDanger: {
		color: Colors.danger,
	},
	textBrand: {
		color: Colors.brand,
	},
	link: {
		color: Colors.blue300,
	},
	surfacePrimary: {
		backgroundColor: Colors.white,
	},
	surfaceSecondary: {
		backgroundColor: Colors.gray100,
	},
	surfaceTertiary: {
		backgroundColor: Colors.gray200,
	},
	surfaceBrand: {
		backgroundColor: Colors.brand,
	},
	surfaceInvert: {
		backgroundColor: Colors.black,
	},
	border: {
		borderColor: Colors.gray200,
	},
	borderSelected: {
		borderColor: Colors.brand,
	},
	borderDanger: {
		borderColor: Colors.danger,
	},
	fontPrimary: {
		fontSize: DefaultSharedComponents.fontSize,
		fontWeight: DefaultSharedComponents.fontWeight as any,
		lineHeight: DefaultSharedComponents.lineHeight * DefaultSharedComponents.fontSize,
		letterSpacing: DefaultSharedComponents.letterSpacing,
	},
	// Default component styles
	primaryButton: {
		paddingTop: defaultButtonPadding.top,
		paddingBottom: defaultButtonPadding.bottom,
		paddingLeft: defaultButtonPadding.left,
		paddingRight: defaultButtonPadding.right,
		borderRadius: defaultButtonBorderRadius.topLeft,
		fontSize: defaultButtonStyles.fontSize,
		fontWeight: defaultButtonStyles.fontWeight as any,
		backgroundColor: Colors.brand,
		color: Colors.white,
	},
	secondaryButton: {
		paddingTop: defaultButtonPadding.top,
		paddingBottom: defaultButtonPadding.bottom,
		paddingLeft: defaultButtonPadding.left,
		paddingRight: defaultButtonPadding.right,
		borderRadius: defaultButtonBorderRadius.topLeft,
		fontSize: defaultButtonStyles.fontSize,
		fontWeight: defaultButtonStyles.fontWeight as any,
		backgroundColor: Colors.gray100,
	},
	center: {
		alignContent: 'center',
		alignItems: 'center',
		textAlign: 'center',
		justifyContent: 'center',
	},
	scrollContainer: {
		flexGrow: 1,
		flexDirection: 'column',
		paddingBottom: isWeb ? 0 : 50,
		// userSelect: 'none',
	},
});

export { Colors, DefaultSharedComponents, DefaultTypography, DefaultSizes, DefaultStyles };
