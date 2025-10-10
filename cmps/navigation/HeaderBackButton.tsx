import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';
import { Div } from '../Div';

export function HeaderBackButton() {
	const router = useRouter();
	return (
		<Pressable
			onPress={() => router.back()}
			style={{ marginLeft: 16, height: 50, width: 50, borderRadius: 100, alignItems: 'center', justifyContent: 'center' }}
		>
			<Div useGlass style={{ width: 50, height: 50, borderRadius: 100, alignItems: 'center', justifyContent: 'center' }}>
				<SymbolView name='chevron.left' type='hierarchical' />
			</Div>
		</Pressable>
	);
}
