import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'PODCAST_EPISODE_PROGRESS';

export interface EpisodeProgress {
	position: number;
	duration: number;
	completed: boolean;
	updatedAt: number;
}

interface PodcastProgressState {
	/** Only episodes that have been played have an entry. */
	progressByEpisodeId: Record<string, EpisodeProgress>;
	hydrated: boolean;

	hydrate: () => Promise<void>;
	getProgress: (episodeId: string) => EpisodeProgress | undefined;
	/** Save progress for an episode (only called for episodes we've played). */
	saveProgress: (episodeId: string, position: number, duration: number, completed?: boolean) => void;
	/** Mark episode as fully played so we don't resume. */
	markAsPlayed: (episodeId: string) => void;
}

async function persistProgress(progressByEpisodeId: Record<string, EpisodeProgress>) {
	await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progressByEpisodeId));
}

export const usePodcastProgressStore = create<PodcastProgressState>((set, get) => ({
	progressByEpisodeId: {},
	hydrated: false,

	hydrate: async () => {
		try {
			const raw = await AsyncStorage.getItem(STORAGE_KEY);
			if (!raw) {
				set({ hydrated: true });
				return;
			}
			const parsed = JSON.parse(raw) as Record<string, EpisodeProgress>;
			// Normalize: ensure updatedAt and completed exist for old entries
			const normalized: Record<string, EpisodeProgress> = {};
			for (const [id, p] of Object.entries(parsed)) {
				if (p && typeof p.position === 'number') {
					normalized[id] = {
						position: p.position,
						duration: typeof p.duration === 'number' ? p.duration : 0,
						completed: Boolean(p.completed),
						updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
					};
				}
			}
			set({ progressByEpisodeId: normalized, hydrated: true });
		} catch {
			set({ hydrated: true });
		}
	},

	getProgress: (episodeId: string) => get().progressByEpisodeId[episodeId],

	saveProgress: (episodeId: string, position: number, duration: number, completed?: boolean) => {
		const { progressByEpisodeId } = get();
		const existing = progressByEpisodeId[episodeId];
		const isCompleted = completed ?? (duration > 0 && (position >= duration - 10 || position >= duration * 0.95));
		const next: EpisodeProgress = {
			position: Math.max(0, position),
			duration: Math.max(0, duration),
			completed: existing?.completed || isCompleted,
			updatedAt: Date.now(),
		};
		const nextMap = { ...progressByEpisodeId, [episodeId]: next };
		set({ progressByEpisodeId: nextMap });
		persistProgress(nextMap).catch(() => {});
	},

	markAsPlayed: (episodeId: string) => {
		const { progressByEpisodeId } = get();
		const existing = progressByEpisodeId[episodeId];
		const next: EpisodeProgress = {
			position: existing?.position ?? 0,
			duration: existing?.duration ?? 0,
			completed: true,
			updatedAt: Date.now(),
		};
		const nextMap = { ...progressByEpisodeId, [episodeId]: next };
		set({ progressByEpisodeId: nextMap });
		persistProgress(nextMap).catch(() => {});
	},
}));
