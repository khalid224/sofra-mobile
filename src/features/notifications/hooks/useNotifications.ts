import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { savePushToken } from '@/features/notifications/services/savePushToken';
import { isSafeNotificationId, safeNotificationScreen } from '@/features/notifications/navigation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredPushToken: string | null = null;
let lastHandledNotificationId: string | null = null;

function logNotificationError(scope: string, error: unknown): void {
  const serialized = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : error;
  console.warn(`[Notifications] ${scope}:`, JSON.stringify(serialized));
}

function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const notificationId = response.notification.request.identifier;
  if (lastHandledNotificationId === notificationId) return;
  lastHandledNotificationId = notificationId;

  const data = response.notification.request.content.data as Record<string, string> | undefined;
  void import('expo-router').then(({ router }) => {
    if (isSafeNotificationId(data?.order_id)) {
      router.push(`/order/${data.order_id}` as never);
    } else if (isSafeNotificationId(data?.thread_id)) {
      router.push('/chat' as never);
    } else {
      const screen = safeNotificationScreen(data?.screen);
      if (screen) router.push(screen as never);
    }
  }).catch((error: unknown) => logNotificationError('deep-link failed', error));
}

export async function removeToken(token = registeredPushToken): Promise<void> {
  if (!token) return;
  const { error } = await supabase.from('device_tokens').delete().eq('token', token);
  if (error) throw error;
  if (registeredPushToken === token) registeredPushToken = null;
}

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void registerForPushNotificationsAsync()
      .then(async (token) => {
        if (cancelled) return;
        registeredPushToken = token;
        await savePushToken(userId, token);
      })
      .catch((error: unknown) => logNotificationError('registration failed', error));

    // Expo push tokens can roll while the app is installed. Persist the new
    // value immediately rather than waiting for the next login/app launch.
    const tokenSub = Notifications.addPushTokenListener((token) => {
      registeredPushToken = token.data;
      void savePushToken(userId, token.data)
        .catch((error: unknown) => logNotificationError('token refresh failed', error));
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    // Covers tapping a notification that cold-started a fully terminated app.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!cancelled && response) handleNotificationResponse(response);
      })
      .catch((error: unknown) => logNotificationError('cold-start response failed', error));

    return () => {
      cancelled = true;
      tokenSub.remove();
      responseSub.remove();
    };
  }, [userId]);
}
