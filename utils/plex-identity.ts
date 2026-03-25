import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const PLEX_PRODUCT = 'Rite';

export function getPlexAppVersion(): string {
	return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '0.0.0';
}

export function getPlexDeviceModel(): string {
	return Device.modelName || 'Unknown Device';
}

/** Human-readable label for Plex device lists and notifications (X-Plex-Device-Name). */
export function getPlexDeviceName(): string {
	return `${getPlexDeviceModel()} (${PLEX_PRODUCT})`;
}

export function getPlexPlatformVersion(): string {
	return Device.osVersion || String(Platform.Version);
}

/**
 * Standard Plex client headers for plex.tv and Plex Media Server.
 * @param clientIdentifier Stable per-install id (must match PIN / server sessions).
 */
export function buildPlexIdentityHeaders(clientIdentifier: string): Record<string, string> {
	return {
		'X-Plex-Client-Identifier': clientIdentifier,
		'X-Plex-Product': PLEX_PRODUCT,
		'X-Plex-Version': getPlexAppVersion(),
		'X-Plex-Platform': Platform.OS,
		'X-Plex-Platform-Version': getPlexPlatformVersion(),
		'X-Plex-Device': getPlexDeviceModel(),
		'X-Plex-Device-Name': getPlexDeviceName(),
	};
}

/** Query string for stream/art URLs where the native player cannot send HTTP headers. */
export function encodePlexIdentityQueryString(headers: Record<string, string>): string {
	return Object.entries(headers)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&');
}

export function appendPlexIdentityQueryToUrl(url: string, clientIdentifier: string): string {
	const suffix = encodePlexIdentityQueryString(buildPlexIdentityHeaders(clientIdentifier));
	const sep = url.includes('?') ? '&' : '?';
	return `${url}${sep}${suffix}`;
}
