import { type RefreshControlProps, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Div } from './Div';

interface MainProps {
	children: React.ReactNode;
	scrollEnabled?: boolean;
	style?: StyleProp<ViewStyle>;
	refreshControl?: React.ReactElement<RefreshControlProps>;
	headerOffset?: number;
}

export function Main({ children, scrollEnabled = true, style, refreshControl, headerOffset = 0 }: MainProps) {
	const backgroundColor = useThemeColor({}, 'background');
	const insets = useSafeAreaInsets();
	const ScrollComponent = scrollEnabled ? ScrollView : Div;
	return (
		<ScrollComponent
			style={{
				flex: 1,
				...(style as any),
				backgroundColor,
			}}
			showsVerticalScrollIndicator={false}
			refreshControl={refreshControl}
		>
			<View
				style={{
					flex: 1,
					backgroundColor,
					paddingTop: insets.top + headerOffset,
					paddingBottom: insets.bottom,
				}}
			>
				{children}
			</View>
		</ScrollComponent>
	);
}
