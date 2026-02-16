import { ThemedText, ThemedTextProps } from "./ThemedText";

export interface TextProps extends ThemedTextProps {
	type?: 'body' | 'bodySM' | 'bodyXS' | 'label' | 'link' | 'linkSM' | 'h1' | 'h2' | 'h3' | 'h4' | 'title' | 'subtitle' | 'defaultSemiBold';
}

export function Text({ children, style, ...props }: TextProps) {
	return <ThemedText style={style} {...props}>{children}</ThemedText>;
}