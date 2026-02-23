import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, createThemedStyles, type ThemeColors } from '@/constants/styles';

export function useColors(): ThemeColors {
	const colorScheme = useColorScheme() ?? 'dark';
	return Colors[colorScheme];
}

export function useThemedStyles() {
	const colors = useColors();
	return useMemo(() => createThemedStyles(colors), [colors]);
}
