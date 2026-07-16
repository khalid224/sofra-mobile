import { useRef } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/States';

const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL ?? '';

/**
 * لوحة الإدارة: تُحمَّل كـ WebView من نفس موقع sofra المنشور.
 * مع حقن بيانات الجلسة حتى يبقى المدير مسجلاً دخوله تلقائياً.
 *
 * فى Phase 2 يمكن استبدالها بشاشات Native كاملة لكل قسم إداري
 * (الطلبات، مركز التوزيع، الطباخين، CRM، التحليلات...)
 */
export default function AdminScreen() {
  const { colors } = useTheme();
  const { session, isAdmin } = useAuth();
  const webviewRef = useRef<WebView>(null);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader showBack title="لوحة الإدارة" showThemeToggle={false} />
        <EmptyState emoji="🔒" title="غير مصرح" description="هذه الصفحة للمديرين فقط" />
      </View>
    );
  }

  if (!WEBSITE_URL) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader showBack title="لوحة الإدارة" showThemeToggle={false} />
        <View style={{ flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.mutedForeground, textAlign: 'center' }}>
            حدد EXPO_PUBLIC_WEBSITE_URL في ملف .env
          </Text>
        </View>
      </View>
    );
  }

  // Inject Supabase session so the web admin dashboard auto-authenticates
  const injectedJS = session
    ? `(function() {
        try {
          window.__SOFRA_RN_SESSION__ = ${JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token })};
        } catch(e) {}
        true;
      })();`
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="لوحة الإدارة" showThemeToggle={false} />
      <WebView
        ref={webviewRef}
        source={{ uri: `${WEBSITE_URL}/admin` }}
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 12 }}>
              جاري تحميل لوحة الإدارة...
            </Text>
          </View>
        )}
        style={{ flex: 1 }}
      />
    </View>
  );
}
