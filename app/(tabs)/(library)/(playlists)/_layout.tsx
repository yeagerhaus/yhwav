import { Stack } from 'expo-router';
import { InternalHeader } from '@/components/navigation/InternalHeader';

export default function PlaylistsLayout() {
	return <Stack screenOptions={{ header: () => <InternalHeader /> }} />;
}
