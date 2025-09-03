import { StyleSheet, Text, View } from 'react-native';

export default function PlaylistsScreen() {
	return (
		<View style={styles.container}>
			<Text style={styles.header}>Playlists</Text>
			<Text style={styles.subtext}>Coming soon...</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
	header: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
	subtext: { fontSize: 16, color: '#888' },
});
