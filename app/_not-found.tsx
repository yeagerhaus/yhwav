import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Div, ThemedText } from '@/components';

export default function NotFoundScreen() {
	return (
		<>
			<Stack.Screen options={{ title: 'Oops!' }} />
			<Div style={styles.container}>
				<ThemedText type='title'>This screen doesn't exist.</ThemedText>
				<Link href='/' style={styles.link}>
					<ThemedText type='link'>Go to home screen!</ThemedText>
				</Link>
			</Div>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 20,
	},
	link: {
		marginTop: 15,
		paddingVertical: 15,
	},
});
