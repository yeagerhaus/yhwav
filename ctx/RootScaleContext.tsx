import type React from 'react';
import { createContext, useContext } from 'react';
import { Easing, type SharedValue, useSharedValue, withTiming } from 'react-native-reanimated';

interface RootScaleContextType {
	scale: SharedValue<number>;
	setScale: (value: number) => void;
}

const SCALE_TIMING = {
	duration: 300,
	easing: Easing.out(Easing.cubic),
} as const;

const RootScaleContext = createContext<RootScaleContextType | null>(null);

export function RootScaleProvider({ children }: { children: React.ReactNode }) {
	const scale = useSharedValue(1);

	const setScale = (value: number) => {
		'worklet';
		try {
			scale.value = withTiming(value, SCALE_TIMING);
		} catch (error) {
			console.warn('Scale animation error:', error);
			scale.value = value;
		}
	};

	return <RootScaleContext.Provider value={{ scale, setScale }}>{children}</RootScaleContext.Provider>;
}

export const useRootScale = () => {
	const context = useContext(RootScaleContext);
	if (!context) {
		throw new Error('useRootScale must be used within a RootScaleProvider');
	}
	return context;
};
