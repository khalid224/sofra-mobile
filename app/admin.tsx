import { useRef } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/States';

const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL ?? '';
const RAW_ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL
  ?? (WEBSITE_URL ? WEBSITE_URL.replace(/\/$/, '') : '');

function parseAdminUrl(value: string): { url: string; origin: string } | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    return { url: parsed.toString(), origin: parsed.origin };
  } catch {
    return null;
  }
}

const ADMIN_CONFIG = parseAdminUrl(RAW_ADMIN_URL);

/**
 * لوحة الإدارة: تُحمَّل من رابط لوحة Next المنشورة.
 * لا يتم حقن رموز جلسة الموبايل داخل صفحة الويب؛ لوحة الإدارة تستخدم
 * جلسة cookies مستقلة حتى لا تتسرب الرموز إلى نطاق خاطئ.
 *
 * فى Phase 2 يمكن استبدالها بشاشات Native كاملة لكل قسم إداري
 * (الطلبات، مركز التوزيع، الطباخين، CRM، التحليلات...)
 */
export default function AdminScreen() {
  const { colors } = useTheme();
  const { isAdmin } = useAuth();
  const webviewRef = useRef<WebView>(null);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader showBack title="لوحة الإدارة" showThemeToggle={false} />
        <EmptyState emoji="🔒" title="غير مصرح" description="هذه الصفحة للمديرين فقط" />
      </View>
    );
  }

  if (!ADMIN_CONFIG) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader showBack title="لوحة الإدارة" showThemeToggle={false} />
        <View style={{ flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.mutedForeground, textAlign: 'center' }}>
            حدد EXPO_PUBLIC_ADMIN_URL كرابط HTTPS صالح في ملف .env
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="لوحة الإدارة" showThemeToggle={false} />
      <WebView
        ref={webviewRef}
        source={{ uri: ADMIN_CONFIG.url }}
        originWhitelist={[ADMIN_CONFIG.origin]}
        onShouldStartLoadWithRequest={(request) => {
          try {
            const target = new URL(request.url);
            return target.protocol === 'https:' && target.origin === ADMIN_CONFIG.origin;
          } catch {
            return false;
          }
        }}
        mixedContentMode="never"
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
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
