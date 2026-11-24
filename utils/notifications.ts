import * as Notifications from 'expo-notifications';
import type { ImperativeRouter } from 'expo-router';

export function setupNotificationHandler() {
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowAlert: true,
			shouldPlaySound: false,
			shouldSetBadge: false,
			shouldShowBanner: true,
			shouldShowList: true,
		}),
	});
}

export async function requestNotificationPermissions() {
	const { status: existing } = await Notifications.getPermissionsAsync();
	if (existing === 'granted') return true;

	const { status } = await Notifications.requestPermissionsAsync();
	return status === 'granted';
}

function openNotificationTarget(router: ImperativeRouter, response: Notifications.NotificationResponse) {
	const data = response.notification.request.content.data as
		| {
				feedId?: string;
				episodeId?: string;
		  }
		| undefined;

	if (data?.episodeId && data?.feedId) {
		router.push({
			pathname: '/(tabs)/(podcasts)/episode/[episodeId]',
			params: { episodeId: data.episodeId, feedId: data.feedId },
		});
	}
}

export function addNotificationResponseListener(router: ImperativeRouter) {
	return Notifications.addNotificationResponseReceivedListener((response) => openNotificationTarget(router, response));
}

/** A notification tapped while the app was killed launches it; the listener above misses that one. */
export async function handleLaunchNotification(router: ImperativeRouter): Promise<void> {
	const response = await Notifications.getLastNotificationResponseAsync();
	if (!response) return;
	openNotificationTarget(router, response);
	await Notifications.clearLastNotificationResponseAsync().catch(() => {});
}
