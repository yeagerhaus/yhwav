import type { DefaultTypography } from '@/constants/styles';

import { ThemedText, type ThemedTextProps } from './ThemedText';

export interface TextProps extends ThemedTextProps {
	type?: keyof typeof DefaultTypography;
}

export function Text({ children, style, ...props }: TextProps) {
	return (
		<ThemedText style={style} {...props}>
			{children}
		</ThemedText>
	);
}
