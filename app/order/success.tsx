import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';

export default function OrderSuccessScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { orderId, orderNumber } = useLocalSearchParams<{ orderId: string; orderNumber: string }>();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.lg,
      }}
    >
      {/* Success Icon */}
      <View
        style={{
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: colors.successSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CheckCircle2 size={60} color={colors.success} />
      </View>

      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Text
          style={{
            fontFamily: fontFamily.extrabold,
            fontSize: fontSize['4xl'],
            color: colors.foreground,
            textAlign: 'center',
          }}
        >
          تم استلام طلبك! 🎉
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.regular,
            fontSize: fontSize.lg,
            color: colors.mutedForeground,
            textAlign: 'center',
            lineHeight: 26,
          }}
        >
          {`طلبك رقم #${orderNumber} قيد المراجعة.`}
          {'\n'}
          سنتواصل معك قريباً عبر الإشعارات.
        </Text>
      </View>

      {/* Info card */}
      <View
        style={{
          backgroundColor: colors.primarySubtle,
          borderRadius: radius.xl,
          padding: spacing.md,
          width: '100%',
          gap: spacing.sm,
        }}
      >
        {[
          { emoji: '⏱️', text: 'وقت التوصيل المتوقع: 30–60 دقيقة' },
          { emoji: '📍', text: 'تابع طلبك من شاشة "طلباتي"' },
          { emoji: '💬', text: 'تواصل معنا فوراً إذا احتجت أي مساعدة' },
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.foreground, flex: 1, textAlign: 'right' }}>
              {item.text}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ width: '100%', gap: spacing.sm }}>
        <Button
          size="lg"
          fullWidth
          onPress={() => router.replace(`/order/${orderId}`)}
        >
          تتبّع طلبي
        </Button>
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onPress={() => router.replace('/(tabs)')}
        >
          العودة للرئيسية
        </Button>
      </View>
    </View>
  );
}
