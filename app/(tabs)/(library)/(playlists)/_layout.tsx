import { Stack, usePathname } from 'expo-router';
import { InternalHeader } from '@/cmps/navigation/InternalHeader';

export default function PlaylistsLayout() {
	const currentScreen = usePathname();
	const title = currentScreen.split('/').pop() || 'Playlists';
	return <Stack screenOptions={{ header: () => <InternalHeader title={title} /> }} />;
}
