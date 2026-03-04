import { Stack } from 'expo-router';
import { InternalHeader } from '@/components/Navigation/InternalHeader';

export default function ArtistsLayout() {
	return <Stack screenOptions={{ header: () => <InternalHeader /> }} />;
}
