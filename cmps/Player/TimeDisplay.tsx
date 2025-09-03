import React from 'react';
import { View, Text } from 'react-native';

interface TimeDisplayProps {
	position: number;
	duration: number;
}

const formatTime = (seconds: number) => {
	const minutes = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

export const TimeDisplay = React.memo(({ position, duration }: TimeDisplayProps) => {
	const currentTime = formatTime(position);
	const remainingTime = `-${formatTime(Math.max(0, duration - position))}`;

	return (
		<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: 'transparent' }}>
			<Text style={{ fontSize: 12, opacity: 0.6, color: '#fff' }}>
				{currentTime}
			</Text>
			<Text style={{ fontSize: 12, opacity: 0.6, color: '#fff' }}>
				{remainingTime}
			</Text>
		</View>
	);
});
