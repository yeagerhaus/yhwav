import type { LoudnessData } from '@/types/song';

export interface CrossfadeConfig {
	defaultDuration: number;
	minDuration: number;
	maxDuration: number;
}

const DEFAULT_CONFIG: CrossfadeConfig = {
	defaultDuration: 4,
	minDuration: 1,
	maxDuration: 8,
};

/**
 * Compute optimal crossfade overlap duration between two consecutive tracks
 * using Plex's per-track loudness analysis data.
 *
 * Heuristics:
 * - LRA (Loudness Range) indicates dynamic range. High LRA tracks have quiet
 *   intros/outros where a longer crossfade sounds natural.
 * - Low peak on the outgoing track suggests a quiet ending — safe for longer overlap.
 * - Large loudness gap between tracks benefits from a longer transition to smooth
 *   the perceived volume change.
 */
export function computeCrossfadeDuration(
	outgoing: LoudnessData | undefined,
	incoming: LoudnessData | undefined,
	config: CrossfadeConfig = DEFAULT_CONFIG,
): number {
	if (!outgoing || !incoming) return config.defaultDuration;

	const avgLRA = (outgoing.lra + incoming.lra) / 2;

	// Tracks ending quietly (peak well below 1.0) blend more naturally with longer fades
	const outPeakFactor = outgoing.peak < 0.7 ? 1.3 : outgoing.peak < 0.85 ? 1.15 : 1.0;

	// Bigger loudness gap → more transition time helps smooth it
	const loudnessGap = Math.abs(outgoing.loudness - incoming.loudness);
	const gapFactor = 1.0 + Math.min(loudnessGap / 20, 0.5);

	// Base duration: map LRA (0–20 LU range) to min–max duration
	const lraDuration = config.minDuration + (avgLRA / 20) * (config.maxDuration - config.minDuration);

	const duration = lraDuration * outPeakFactor * gapFactor;
	return Math.max(config.minDuration, Math.min(config.maxDuration, Math.round(duration * 10) / 10));
}

/**
 * Determine whether crossfade should be suppressed for a transition.
 * Returns true when tracks should play gaplessly instead.
 */
export function shouldSuppressCrossfade(
	outgoing: { album: string; discNumber: number; trackNumber: number; source?: string },
	incoming: { album: string; discNumber: number; trackNumber: number; source?: string },
): boolean {
	if (outgoing.source === 'podcast' || incoming.source === 'podcast') return true;

	// Sequential tracks on the same album — preserve intentional album flow
	if (
		outgoing.album &&
		outgoing.album === incoming.album &&
		outgoing.discNumber === incoming.discNumber &&
		incoming.trackNumber === outgoing.trackNumber + 1
	) {
		return true;
	}

	return false;
}
