import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Main({ children, scrollEnabled = true }: any) {
	const ScrollComponent = scrollEnabled ? ScrollView : View;
	return (
		<ScrollComponent
			style={{
				flex: 1,
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
