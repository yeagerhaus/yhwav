import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, createThemedStyles, type ThemeColors } from '@/constants/styles';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';

export function useColors(): ThemeColors {
	const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
	const brandColor = useAppearanceStore((s) => s.brandColor);
	// Stable object per (scheme, brand) so consumers' memos (e.g. useThemedStyles) don't rebuild every render.
	return useMemo(() => {
		const base = Colors[colorScheme];
		return brandColor ? { ...base, brand: brandColor, borderSelected: brandColor } : base;
	}, [colorScheme, brandColor]);
}

export function useThemedStyles() {
	const colors = useColors();
	return useMemo(() => createThemedStyles(colors), [colors]);
}
