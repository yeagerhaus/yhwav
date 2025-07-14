import { InternalHeader } from '@/cmps/navigation/InternalHeader';
import { Stack, usePathname } from 'expo-router';

export default function ArtistsLayout() {
	const currentScreen = usePathname();
	const title = currentScreen.split('/').pop() || 'Artists';
	return <Stack screenOptions={{ header: () => <InternalHeader title={title} /> }} />;
}