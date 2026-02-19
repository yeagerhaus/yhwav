import Slider from '@react-native-community/slider';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Div, Text } from '@/components';
import { Main } from '@/components/Main';
import { Colors, DefaultStyles } from '@/constants/styles';
import {
	EQ_PRESETS,
	formatFrequency,
	usePlaybackSettingsStore,
} from '@/hooks/usePlaybackSettingsStore';
import { hexWithOpacity } from '@/utils/styles';

const EQ_TRACK_LENGTH = 150;
const EQ_SLIDER_THICKNESS = 34;

function SwitchRow({ label, description, value, onValueChange }: {
	label: string;
	description?: string;
	value: boolean;
	onValueChange: (v: boolean) => void;
}) {
	return (
		<Div transparent style={styles.switchRow}>
			<Div transparent style={{ flex: 1, marginRight: 12 }}>
				<Text type='body'>{label}</Text>
				{description && (
					<Text type='bodyXS' colorVariant='muted' style={{ marginTop: 2 }}>
						{description}
					</Text>
				)}
			</Div>
			<Switch
				value={value}
				onValueChange={onValueChange}
				trackColor={{ false: Colors.surfaceDark, true: hexWithOpacity(Colors.brandPrimary, 0.5) }}
				thumbColor={value ? Colors.brandPrimary : Colors.textMuted}
			/>
		</Div>
	);
}

function EQBandSlider({ frequency, gain, onValueChange, onSlidingStart, onSlidingComplete }: {
	frequency: number;
	gain: number;
	onValueChange: (v: number) => void;
	onSlidingStart?: () => void;
	onSlidingComplete?: (v: number) => void;
}) {
	return (
		<View style={styles.bandColumn}>
			<Text type='bodyXS' colorVariant='muted' style={styles.bandGainLabel}>
				{gain > 0 ? `+${gain.toFixed(0)}` : gain.toFixed(0)}
			</Text>
			<View style={styles.sliderWrapper}>
				<Slider
					style={styles.rotatedSlider}
					minimumValue={-12}
					maximumValue={12}
					step={1}
					value={gain}
					onValueChange={onValueChange}
					onSlidingStart={onSlidingStart}
					onSlidingComplete={onSlidingComplete}
					minimumTrackTintColor={Colors.brandPrimary}
					maximumTrackTintColor={Colors.surfaceDark}
					thumbTintColor={Colors.brandPrimary}
				/>
			</View>
			<Text type='bodyXS' colorVariant='muted' style={styles.bandFreqLabel}>
				{formatFrequency(frequency)}
			</Text>
		</View>
	);
}

function PresetChip({ name, selected, onPress }: {
	name: string;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<TouchableOpacity
			style={[styles.presetChip, selected && styles.presetChipSelected]}
			onPress={onPress}
		>
			<Text
				type='linkSM'
				style={{ color: selected ? Colors.white : Colors.textMuted }}
			>
				{name}
			</Text>
		</TouchableOpacity>
	);
}

export default function PlaybackScreen() {
	const {
		equalizerEnabled,
		equalizerBands,
		selectedPreset,
		outputGainDb,
		normalizationEnabled,
		monoAudioEnabled,
		crossfadeEnabled,
		crossfadeDuration,
		crossfadeAdaptiveEnabled,
		setEqualizerEnabled,
		setBandGain,
		setPreset,
		resetEQ,
		setOutputGain,
		setNormalizationEnabled,
		setMonoAudioEnabled,
		setCrossfadeEnabled,
		setCrossfadeDuration,
		setCrossfadeAdaptiveEnabled,
	} = usePlaybackSettingsStore();

	const [scrollEnabled, setScrollEnabled] = useState(true);
	const gainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleGainChange = useCallback((value: number) => {
		if (gainTimerRef.current) clearTimeout(gainTimerRef.current);
		gainTimerRef.current = setTimeout(() => setOutputGain(value), 50);
	}, [setOutputGain]);

	const handleBandSlidingStart = useCallback(() => setScrollEnabled(false), []);
	const handleBandSlidingComplete = useCallback(() => setScrollEnabled(true), []);

	const bandChangeHandlers = useRef<((v: number) => void)[]>([]);
	if (bandChangeHandlers.current.length !== equalizerBands.length) {
		bandChangeHandlers.current = equalizerBands.map((_, i) => (v: number) => setBandGain(i, v));
	}

	return (
		<Main style={{ paddingHorizontal: 16 }}>
			<ScrollView showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled} contentContainerStyle={{ paddingBottom: 40 }}>
				<Div transparent>
					<Text type='h1' style={{ marginBottom: 16 }}>
						Playback
					</Text>
				</Div>

				{/* Equalizer Section */}
				<Div transparent style={DefaultStyles.section}>
					<Text type='h3' style={DefaultStyles.sectionTitle}>
						Equalizer
					</Text>

					<SwitchRow
						label='Enable Equalizer'
						value={equalizerEnabled}
						onValueChange={setEqualizerEnabled}
					/>

					{equalizerEnabled && (
						<Div transparent style={{ marginTop: 16 }}>
							{/* Presets */}
							<Text type='label' colorVariant='muted' style={{ marginBottom: 8 }}>
								Presets
							</Text>
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								style={{ marginBottom: 16 }}
								contentContainerStyle={{ gap: 8 }}
							>
								{Object.keys(EQ_PRESETS).map((name) => (
									<PresetChip
										key={name}
										name={name}
										selected={selectedPreset === name}
										onPress={() => setPreset(name)}
									/>
								))}
							</ScrollView>

							{/* EQ Band Sliders */}
							<View style={styles.bandsContainer}>
								<Div transparent style={styles.bandScaleLabels}>
									<Text type='bodyXS' colorVariant='muted'>+12</Text>
									<Text type='bodyXS' colorVariant='muted'>0</Text>
									<Text type='bodyXS' colorVariant='muted'>-12</Text>
								</Div>
								{equalizerBands.map((band, i) => (
									<EQBandSlider
										key={band.frequency}
										frequency={band.frequency}
										gain={band.gain}
										onValueChange={bandChangeHandlers.current[i]}
										onSlidingStart={handleBandSlidingStart}
										onSlidingComplete={handleBandSlidingComplete}
									/>
								))}
							</View>

							<TouchableOpacity
								style={[DefaultStyles.cancelButton, { marginTop: 12 }]}
								onPress={resetEQ}
							>
								<Text type='h3'>Reset to Flat</Text>
							</TouchableOpacity>
						</Div>
					)}
				</Div>

				{/* Output Gain Section */}
				<Div transparent style={DefaultStyles.section}>
					<Text type='h3' style={DefaultStyles.sectionTitle}>
						Output Gain
					</Text>
					<Text style={[DefaultStyles.sectionDescription, { marginBottom: 12 }]}>
						Boost or cut the overall output level.
					</Text>
					<Div transparent style={styles.gainRow}>
						<Text type='bodyXS' colorVariant='muted'>-10 dB</Text>
						<Div transparent style={{ flex: 1, marginHorizontal: 8 }}>
							<Slider
								minimumValue={-10}
								maximumValue={10}
								step={0.5}
								value={outputGainDb}
								onValueChange={handleGainChange}
								minimumTrackTintColor={Colors.brandPrimary}
								maximumTrackTintColor={Colors.surfaceDark}
								thumbTintColor={Colors.brandPrimary}
							/>
						</Div>
						<Text type='bodyXS' colorVariant='muted'>+10 dB</Text>
					</Div>
					<Div transparent style={{ alignItems: 'center', marginTop: 4 }}>
						<TouchableOpacity onPress={() => setOutputGain(0)}>
							<Text type='link' colorVariant='brand'>
								{outputGainDb > 0 ? `+${outputGainDb.toFixed(1)}` : outputGainDb.toFixed(1)} dB
								{outputGainDb !== 0 ? ' (tap to reset)' : ''}
							</Text>
						</TouchableOpacity>
					</Div>
				</Div>

				{/* Crossfade Section */}
				<Div transparent style={DefaultStyles.section}>
					<Text type='h3' style={DefaultStyles.sectionTitle}>
						Sweet Fades
					</Text>

					<SwitchRow
						label='Enable Crossfade'
						description='Smoothly blend between tracks using loudness analysis from your Plex server.'
						value={crossfadeEnabled}
						onValueChange={setCrossfadeEnabled}
					/>

					{crossfadeEnabled && (
						<Div transparent style={{ marginTop: 12 }}>
							<SwitchRow
								label='Adaptive Duration'
								description='Automatically adjust crossfade length based on each track&apos;s dynamic range. When off, uses the fixed duration below.'
								value={crossfadeAdaptiveEnabled}
								onValueChange={setCrossfadeAdaptiveEnabled}
							/>

							<View style={styles.divider} />

							<Div transparent style={{ paddingVertical: 8 }}>
								<Text type='body'>
									{crossfadeAdaptiveEnabled ? 'Default Duration' : 'Crossfade Duration'}
								</Text>
								<Text type='bodyXS' colorVariant='muted' style={{ marginTop: 2, marginBottom: 8 }}>
									{crossfadeAdaptiveEnabled
										? 'Fallback duration when loudness data is unavailable.'
										: 'How long tracks overlap during transitions.'}
								</Text>
								<Div transparent style={styles.gainRow}>
									<Text type='bodyXS' colorVariant='muted'>1s</Text>
									<Div transparent style={{ flex: 1, marginHorizontal: 8 }}>
										<Slider
											minimumValue={1}
											maximumValue={12}
											step={0.5}
											value={crossfadeDuration}
											onValueChange={setCrossfadeDuration}
											minimumTrackTintColor={Colors.brandPrimary}
											maximumTrackTintColor={Colors.surfaceDark}
											thumbTintColor={Colors.brandPrimary}
										/>
									</Div>
									<Text type='bodyXS' colorVariant='muted'>12s</Text>
								</Div>
								<Div transparent style={{ alignItems: 'center', marginTop: 4 }}>
									<Text type='link' colorVariant='brand'>
										{crossfadeDuration.toFixed(1)}s
									</Text>
								</Div>
							</Div>
						</Div>
					)}
				</Div>

				{/* Audio Processing Section */}
				<Div transparent style={DefaultStyles.section}>
					<Text type='h3' style={DefaultStyles.sectionTitle}>
						Audio Processing
					</Text>

					<SwitchRow
						label='Normalization'
						description='Prevents clipping and distortion when EQ or gain boosts the signal above 0 dBFS.'
						value={normalizationEnabled}
						onValueChange={setNormalizationEnabled}
					/>

					<View style={styles.divider} />

					<SwitchRow
						label='Mono Audio'
						description='Mixes left and right channels together. Useful for single-earbud listening.'
						value={monoAudioEnabled}
						onValueChange={setMonoAudioEnabled}
					/>
				</Div>
			</ScrollView>
		</Main>
	);
}

const styles = StyleSheet.create({
	switchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 8,
	},
	bandsContainer: {
		flexDirection: 'row',
		alignItems: 'stretch',
		justifyContent: 'space-between',
		height: EQ_TRACK_LENGTH + 28,
		paddingLeft: 28,
	},
	bandScaleLabels: {
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 20,
		justifyContent: 'space-between',
		width: 24,
	},
	bandColumn: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	bandGainLabel: {
		textAlign: 'center',
		height: 14,
	},
	bandFreqLabel: {
		textAlign: 'center',
		height: 14,
	},
	sliderWrapper: {
		width: EQ_SLIDER_THICKNESS,
		height: EQ_TRACK_LENGTH,
		justifyContent: 'center',
		alignItems: 'center',
	},
	rotatedSlider: {
		width: EQ_TRACK_LENGTH,
		height: EQ_SLIDER_THICKNESS,
		transform: [{ rotate: '-90deg' }],
	},
	presetChip: {
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: 100,
		backgroundColor: Colors.surfaceDark,
		borderWidth: 1,
		borderColor: Colors.surfaceDarkBorder,
	},
	presetChipSelected: {
		backgroundColor: Colors.brandPrimary,
		borderColor: Colors.brandPrimary,
	},
	gainRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: Colors.surfaceDark,
		marginVertical: 4,
	},
});
