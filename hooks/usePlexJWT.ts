import { useEffect, useState } from 'react';
import { initializePlexJWT, plexJWTService } from '@/utils/plex';

export interface PlexJWTState {
	isInitialized: boolean;
	isInitializing: boolean;
	error: string | null;
}

/**
 * Hook to manage Plex JWT authentication state
 * Call this hook early in your app to ensure JWT is properly initialized
 */
export const usePlexJWT = (): PlexJWTState => {
	const [isInitialized, setIsInitialized] = useState(false);
	const [isInitializing, setIsInitializing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const initialize = async () => {
			if (isInitialized || isInitializing) return;

			setIsInitializing(true);
			setError(null);

			try {
				await initializePlexJWT();
				setIsInitialized(true);
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Plex JWT';
				setError(errorMessage);
				console.error('Plex JWT initialization failed:', err);
			} finally {
				setIsInitializing(false);
			}
		};

		initialize();
	}, [isInitialized, isInitializing]);

	return {
		isInitialized,
		isInitializing,
		error,
	};
};

/**
 * Hook to get the current JWT token status
 * Useful for debugging or showing auth status in UI
 */
export const usePlexTokenStatus = () => {
	const [tokenStatus, setTokenStatus] = useState<{
		hasToken: boolean;
		isExpired: boolean;
		expiresAt: number | null;
	}>({
		hasToken: false,
		isExpired: false,
		expiresAt: null,
	});

	useEffect(() => {
		const checkTokenStatus = () => {
			const hasToken = plexJWTService.isInitialized();
			// Note: We don't expose internal expiry details for security
			setTokenStatus({
				hasToken,
				isExpired: false, // The service handles refresh automatically
				expiresAt: null,
			});
		};

		checkTokenStatus();

		// Check status periodically
		const interval = setInterval(checkTokenStatus, 30000); // Every 30 seconds

		return () => clearInterval(interval);
	}, []);

	return tokenStatus;
};
