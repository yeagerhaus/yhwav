import { Stack } from 'expo-router';
import { InternalHeader } from '@/components/navigation/InternalHeader';

export default function AlbumsLayout() {
	return <Stack screenOptions={{ header: () => <InternalHeader /> }} />;
}
