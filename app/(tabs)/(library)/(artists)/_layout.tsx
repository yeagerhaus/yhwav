import { Stack, usePathname } from 'expo-router';
import { InternalHeader } from '@/cmps/navigation/InternalHeader';

export default function ArtistsLayout() {
	const currentScreen = usePathname();
	const title = currentScreen.split('/').pop() || 'Artists';
	return <Stack screenOptions={{ header: () => <InternalHeader title={title} /> }} />;
}
