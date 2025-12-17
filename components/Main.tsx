import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Div } from './Div';

interface MainProps {
	children: React.ReactNode;
	scrollEnabled?: boolean;
	style?: StyleProp<ViewStyle>;
}

export function Main({ children, scrollEnabled = true, style }: MainProps) {
	const ScrollComponent = scrollEnabled ? ScrollView : Div;
	return (
		<ScrollComponent
			style={{
				flex: 1,
				...(style as any),
			}}
		>
			<SafeAreaView
				style={{
					flex: 1,
					backgroundColor: 'transparent',
				}}
			>
				{children}
			</SafeAreaView>
		</ScrollComponent>
	);
}
