import { type RefreshControlProps, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Div } from './Div';

interface MainProps {
	children: React.ReactNode;
	scrollEnabled?: boolean;
	style?: StyleProp<ViewStyle>;
	refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function Main({ children, scrollEnabled = true, style, refreshControl }: MainProps) {
	const backgroundColor = useThemeColor({}, 'background');
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
			<SafeAreaView
				style={{
					flex: 1,
					backgroundColor,
				}}
			>
				{children}
			</SafeAreaView>
		</ScrollComponent>
	);
}
