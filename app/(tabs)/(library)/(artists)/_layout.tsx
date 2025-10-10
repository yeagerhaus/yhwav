import { Stack } from 'expo-router';
import { InternalHeader } from '@/cmps/navigation/InternalHeader';

export default function ArtistsLayout() {
	return <Stack screenOptions={{ header: () => <InternalHeader /> }} />;
}
