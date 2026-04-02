import * as Network from 'expo-network';

export type NetworkPlaybackRoute = 'wifi' | 'cellular' | 'unknown';

let cachedRoute: NetworkPlaybackRoute = 'unknown';

function stateToRoute(s: Network.NetworkState): NetworkPlaybackRoute {
	if (s.isConnected === false) return 'unknown';
	const t = s.type;
	if (t === Network.NetworkStateType.CELLULAR) return 'cellular';
	if (t === Network.NetworkStateType.WIFI || t === Network.NetworkStateType.ETHERNET) return 'wifi';
	return 'unknown';
}

/** Synchronous hint for playback URL building; updated by init listener. */
export function getCachedNetworkPlaybackRoute(): NetworkPlaybackRoute {
	return cachedRoute;
}

export async function refreshNetworkPlaybackRoute(): Promise<void> {
	try {
		const s = await Network.getNetworkStateAsync();
		cachedRoute = stateToRoute(s);
	} catch {
		cachedRoute = 'unknown';
	}
}

/** Subscribe to network changes; prime state once. Returns cleanup. */
export function initNetworkPlaybackRoute(): () => void {
	refreshNetworkPlaybackRoute().catch(() => {});

	const sub = Network.addNetworkStateListener((event) => {
		cachedRoute = stateToRoute(event);
	});

	return () => sub.remove();
}
