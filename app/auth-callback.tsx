/**
 * auth-callback.tsx
 *
 * This screen handles the OAuth deep-link redirect when the app is opened
 * from a killed/background state (cold-start scenario on Android).
 *
 * Flow:
 *   Google → Supabase → sofra://auth-callback?code=xxx
 *   Android opens the app → Expo Router routes to this screen
 *   This screen exchanges the code for a session → navigates to home
 *
 * When the app is already open (warm-start), WebBrowser.openAuthSessionAsync
 * intercepts the redirect and returns it to auth.tsx inline — this screen
 * is NOT invoked in that case.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeContext';

// Completes the auth session so the WebBrowser tab closes cleanly
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  }>();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle PKCE / Authorization Code flow (code in query params)
        if (params.code) {
          console.log('[AuthCallback] Exchanging code for session...');
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) throw error;
          Toast.show({ type: 'success', text1: 'مرحباً بك!', text2: 'تم تسجيل الدخول بنجاح' });
          router.replace('/(tabs)');
          return;
        }

        // Handle Implicit flow (tokens in hash — Expo Router parses them as params)
        if (params.access_token && params.refresh_token) {
          console.log('[AuthCallback] Setting session from tokens...');
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (error) throw error;
          Toast.show({ type: 'success', text1: 'مرحباً بك!', text2: 'تم تسجيل الدخول بنجاح' });
          router.replace('/(tabs)');
          return;
        }

        // Handle error redirects from Supabase
        if (params.error) {
          console.error('[AuthCallback] OAuth error:', params.error, params.error_description);
          Toast.show({ type: 'error', text1: 'خطأ في تسجيل الدخول', text2: params.error_description ?? params.error });
          router.replace('/auth');
          return;
        }

        // Fallback: check if a session exists already
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace('/(tabs)');
        } else {
          router.replace('/auth');
        }
      } catch (e: unknown) {
        console.error('[AuthCallback] Error:', e);
        Toast.show({
          type: 'error',
          text1: 'خطأ في تسجيل الدخول',
          text2: e instanceof Error ? e.message : 'حدث خطأ غير متوقع',
        });
        router.replace('/auth');
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 16, color: colors.mutedForeground }}>جاري تسجيل الدخول...</Text>
    </View>
  );
}
