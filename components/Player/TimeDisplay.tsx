import React from 'react';
import { Text, View } from 'react-native';
import { useAudioStore } from '@/hooks/useAudioStore';
import { Div } from '../Div';

const formatTime = (seconds: number) => {
	const minutes = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

export const TimeDisplay = React.memo(() => {
	const position = useAudioStore((state) => state.position);
	const duration = useAudioStore((state) => state.duration);

	const currentTime = formatTime(position);
	const remainingTime = `-${formatTime(Math.max(0, duration - position))}`;

	return (
		<Div style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: 'transparent' }}>
			<Text style={{ fontSize: 12, opacity: 0.6, color: '#fff' }}>{currentTime}</Text>
			<Text style={{ fontSize: 12, opacity: 0.6, color: '#fff' }}>{remainingTime}</Text>
		</Div>
	);
});
