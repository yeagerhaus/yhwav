import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Div } from '../Div';
import { HeaderBackButton } from './HeaderBackButton';

export function InternalHeader() {
	const insets = useSafeAreaInsets();

	return (
		<Div
			style={{
				position: 'absolute',
				top: 0,
				alignItems: 'center',
				backgroundColor: 'transparent',
				width: '100%',
			}}
		>
			{/* <LinearGradient
				colors={['#000000', 'transparent']}
				style={{ paddingTop: insets.top }}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
			> */}
			<Div
				style={{
					width: '100%',
					height: 100,
					display: 'flex',
					justifyContent: 'flex-end',
					backgroundColor: 'transparent',
				}}
			>
				<HeaderBackButton />
			</Div>
			{/* </LinearGradient> */}
		</Div>
	);
}
