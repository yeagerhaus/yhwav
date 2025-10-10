import { Stack } from 'expo-router';
import { InternalHeader } from '@/cmps/navigation/InternalHeader';

export default function AlbumsLayout() {
	return <Stack screenOptions={{ header: () => <InternalHeader /> }} />;
}
