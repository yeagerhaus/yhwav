import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View as ThemedView } from 'react-native';

export const ExtraControls = React.memo(() => {
	return (
		<ThemedView style={styles.extraControls}>
			<Pressable style={styles.extraControlButton}>
				<Ionicons name='chatbubble-outline' size={24} color='#fff' />
			</Pressable>
			<Pressable style={styles.extraControlButton}>
				<ThemedView style={styles.extraControlIcons}>
					<Ionicons name='volume-off' size={26} color='#fff' marginRight={-6} />
					<Ionicons name='bluetooth' size={24} color='#fff' />
				</ThemedView>
			</Pressable>
			<Pressable style={styles.extraControlButton}>
				<Ionicons name='list-outline' size={24} color='#fff' />
			</Pressable>
		</ThemedView>
	);
});

const styles = StyleSheet.create({
	extraControls: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		width: '100%',
		paddingHorizontal: 20,
		marginTop: 26,
		backgroundColor: 'transparent',
	},
	extraControlButton: {
		alignItems: 'center',
		opacity: 0.8,
		height: 60,
	},
	extraControlIcons: {
		flexDirection: 'row',
	},
});
