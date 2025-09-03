import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from './ThemedView';

export function Main({ children }: any) {
	return (
		<SafeAreaView
			style={{
				flex: 1,
				backgroundColor: 'transparent',
			}}
		>
			<ThemedView
				style={{
					flex: 1,
					// paddingHorizontal: 16,
					// paddingTop: 12,
					// paddingBottom: 24,
				}}
			>
				{children}
			</ThemedView>
		</SafeAreaView>
	);
}
