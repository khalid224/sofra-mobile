import { useEffect, useState } from "react";
import { I18nManager, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from "@expo-google-fonts/cairo";
import { QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider, useTheme } from "@/theme/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { queryClient } from "@/lib/queryClient";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAppStore } from "@/store";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { MiniCart } from "@/components/shared/MiniCart";
import * as WebBrowser from 'expo-web-browser';

// Required at the root level so any lingering auth sessions are completed
// on every app render — works for both warm and cold OAuth redirects
WebBrowser.maybeCompleteAuthSession();

// Force RTL once before first render
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Handles onboarding redirect on first launch */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isOnboardingComplete, loadOnboardingStatus } = useAppStore();
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadOnboardingStatus().then(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!checked) return;
    const inOnboarding = segments[0] === "onboarding";
    if (!isOnboardingComplete && !inOnboarding) {
      router.replace("/onboarding");
    }
  }, [checked, isOnboardingComplete, segments]);

  if (!checked) return null;
  return <>{children}</>;
}

function AppContent() {
  const { colors, isDark } = useTheme();
  useNotifications();
  useNetworkStatus();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, animation: "fade", freezeOnBlur: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding/index" options={{ animation: "fade" }} />
        <Stack.Screen name="food/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen
          name="food/quick/[id]"
          options={{ presentation: "transparentModal", animation: "fade", contentStyle: { backgroundColor: "transparent" } }}
        />
        <Stack.Screen name="order/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="order/success" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="checkout/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="auth" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="search/index" options={{ animation: "fade" }} />
        <Stack.Screen name="chat/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="reviews/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="complaints/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="notifications/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="favorites/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="settings/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="profile/index" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="profile/addresses" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="admin" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="contact" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false, animation: "fade" }} />
      </Stack>
      <MiniCart />
      <Toast />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Tajawal_400Regular: Cairo_400Regular,
    Tajawal_500Medium: Cairo_500Medium,
    Tajawal_700Bold: Cairo_700Bold,
    Tajawal_800ExtraBold: Cairo_800ExtraBold,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
      setReady(true);
    }
  }, [fontsLoaded, fontError]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <CartProvider>
                <ErrorBoundary>
                  <OnboardingGuard>
                    <AppContent />
                  </OnboardingGuard>
                </ErrorBoundary>
              </CartProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
