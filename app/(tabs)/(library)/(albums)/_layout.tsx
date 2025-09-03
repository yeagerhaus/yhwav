import { Stack, usePathname } from 'expo-router';
import { InternalHeader } from '@/cmps/navigation/InternalHeader';

export default function AlbumsLayout() {
	const currentScreen = usePathname();
	const title = currentScreen.split('/').pop() || 'Albums';
	return <Stack screenOptions={{ header: () => <InternalHeader title={title} /> }} />;
}
