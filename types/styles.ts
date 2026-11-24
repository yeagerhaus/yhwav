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

export type ButtonStyle = TextContainer & {
	height?: string;
	width?: string;
	selected?: TextContainer;
	disabled?: TextContainer;
};
