import { InternalHeader } from '@/cmps/navigation/InternalHeader';
import { Stack, usePathname } from 'expo-router';

export default function PlaylistsLayout() {
	const currentScreen = usePathname();
	const title = currentScreen.split('/').pop() || 'Playlists';
	return <Stack screenOptions={{ header: () => <InternalHeader title={title} /> }} />;
}