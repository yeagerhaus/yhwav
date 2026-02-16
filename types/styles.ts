/**
 * Basic Types
 */

export type PaddingType = Partial<{
	top: number;
	right: number;
	bottom: number;
	left: number;
}>;

export type BorderRadiusType = Partial<{
	topLeft: number;
	topRight: number;
	bottomLeft: number;
	bottomRight: number;
}>;

export type ContainerStyles = Partial<{
	display: string;
	flexDir: string;
	justifyContent: string;
	alignItems: string;
	textAlign: string;
	padding: PaddingType;
	margin: PaddingType;
	borderRadius: BorderRadiusType;
	bg: string;
	bgHover: string;
	borderColor: string;
	borderColorHover: string;
	backgroundImage: string;
}>;

export type TextStyles = Partial<{
	color: string;
	colorHover: string;
	fontWeight: string | number;
	fontSize: number;
	fontFamily: string;
}>;

export type TextContainer = ContainerStyles &
	TextStyles & {
		textDefault?: string;
		textAlt?: string;
		textSuccess?: string;
		textLoading?: string;
	};

/**
 * Style Types
 */

export type InputStyle = TextContainer & {
	placeholder?: string;
	selected?: TextContainer;
	disabled?: TextContainer;
};

export type ButtonStyle = TextContainer & {
	height?: string;
	width?: string;
	selected?: TextContainer;
	disabled?: TextContainer;
};

export type BrandColorPallet = Partial<{
	brandColor: string;
	secondaryColor: string;
	specialColor: string;
	linkColor: string;
	successColor: string;
	warningColor: string;
	dangerColor: string;
	textBrand: string;
	textPrimary: string;
	textSecondary: string;
	surfacePrimary: string;
	surfaceSecondary: string;
	borderPrimary: string;
}>;

export type BrandControlStyles = Partial<{
	input: InputStyle;
	buttonPrimary: ButtonStyle;
	buttonSecondary: ButtonStyle;
	buttonSpecial: ButtonStyle;
}>;

export type BrandStyle = BrandColorPallet &
	TextStyles &
	BrandControlStyles & {
		headerBackground?: string;
		footerBackground?: string;
	};

export type BrandLogos = Partial<{
	logo: string;
	squareLogo: string;
	logoPlacement: 'onCover' | 'belowCover';
	fullLogo: string;
	coverBackground: string;
	mmsLogo: string;
	optInLogo: string;
}>;
