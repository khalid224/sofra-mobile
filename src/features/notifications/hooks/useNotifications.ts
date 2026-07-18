import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'sofra',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#CA4B20',
    });
  }

  const projectId =
    (Constants.expoConfig as any)?.extra?.eas?.projectId as string | undefined;
  const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const token = tokenData.data;
  console.log('[Notifications] Expo Push Token:', token);
  return token;
}

async function saveToken(userId: string, token: string): Promise<void> {
  await supabase.from('device_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: Platform.OS,
      last_used: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
}

export async function removeToken(token: string): Promise<void> {
  await supabase.from('device_tokens').delete().eq('token', token);
}

export function useNotifications() {
  const { user } = useAuth();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    registerForPushNotifications().then((token) => {
      if (cancelled || !token) return;
      tokenRef.current = token;
      saveToken(user.id, token);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      // Deep link handling: navigate to the right screen based on notification payload
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.order_id) {
        import('expo-router').then(({ router }) => {
          router.push(`/order/${data.order_id}` as never);
        }).catch(() => undefined);
      } else if (data?.thread_id) {
        import('expo-router').then(({ router }) => {
          router.push('/chat' as never);
        }).catch(() => undefined);
      } else if (data?.screen) {
        import('expo-router').then(({ router }) => {
          router.push(data.screen as never);
        }).catch(() => undefined);
      }
    });

    return () => {
      cancelled = true;
      responseSub.remove();
    };
  }, [user?.id]);
}
