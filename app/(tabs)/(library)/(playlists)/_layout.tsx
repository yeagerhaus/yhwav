import { Stack } from 'expo-router';
import { InternalHeader } from '@/cmps/navigation/InternalHeader';

export default function PlaylistsLayout() {
	return <Stack screenOptions={{ header: () => <InternalHeader /> }} />;
}
