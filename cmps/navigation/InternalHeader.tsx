import { SafeAreaView, StyleSheet, useColorScheme, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';

export interface InternalHeaderProps {
	title: string;
}
// type HeaderTitleProps = {
// 	title: string;
// };

// export function Title({ title }: HeaderTitleProps) {
// 	const { brandStyle } = useSettingsCtx();
// 	const goBack = () => {
// 		if (router.canGoBack()) {
// 			router.back();
// 		} else {
// 			router.replace('/w/dashboard');
// 		}
// 	};

// 	return (
// 		<Div row width>
// 			<Div.Item row start style={{ alignItems: 'center', position: 'absolute', left: 0, top: 3, zIndex: 9999 }}>
// 				<Icon width={20} height={20} type='CHEVRON_LEFT' color={brandStyle?.brandColor} />
// 				<Text type='link' color='link' style={{ textAlign: 'right', fontSize: 16 }} onPress={() => goBack()}>
// 					Back
// 				</Text>
// 			</Div.Item>
// 			<Div.Item center style={{ flexGrow: 1, alignItems: 'center' }}>
// 				<Text type='h3' color='primary' numberOfLines={1} ellipsizeMode='tail' style={{ textAlign: 'center', maxWidth: '60%' }}>
// 					{title}
// 				</Text>
// 			</Div.Item>
// 		</Div>
// 	);
// }

export function InternalHeader({ title }: InternalHeaderProps) {
	const colorScheme = useColorScheme();

	return (
		<SafeAreaView
			style={{
				alignItems: 'center',
				backgroundColor: 'transparent',
			}}
		>
			<BlurView
				tint={colorScheme === 'dark' ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
				intensity={80}
				style={StyleSheet.absoluteFill}
			>
				<View
					style={{
						height: 60,
					paddingVertical: 12,
					paddingHorizontal: 16,

					alignItems: 'center',
					width: '100%',
						flexDirection: 'row',
					}}
				>
					<Text style={{ textAlign: 'center',	fontSize: 16, fontWeight: '700', lineHeight: 24, letterSpacing: 0.4 }}>
						{title}
					</Text>
				</View>

			</BlurView>
		</SafeAreaView>
	);
}
