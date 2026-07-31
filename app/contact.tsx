import { Linking, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Phone, MessageCircle, MapPin, Mail } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { openWhatsApp } from '@/lib/whatsapp';
import { fetchSettings } from '@/features/home/api/settings.api';
import { QUERY_KEYS } from '@/constants';

export default function ContactScreen() {
  const { colors } = useTheme();
  const settings = useQuery({ queryKey: [QUERY_KEYS.SETTINGS], queryFn: fetchSettings, staleTime: 300_000 });

  const phone = (settings.data?.business_phone as string | undefined) ?? '';
  const wa = (settings.data?.whatsapp_number as string | undefined) ?? '';
  const address = (settings.data?.business_address as string | undefined) ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="اتصل بنا" showThemeToggle={false} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['3xl'], color: colors.foreground, textAlign: 'right' }}>
          نحن هنا لمساعدتك
        </Text>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.mutedForeground, textAlign: 'right', lineHeight: 26 }}>
          لأي استفسار أو شكوى، تواصل معنا عبر الوسائل التالية وسنرد عليك في أقرب وقت.
        </Text>

        {wa && (
          <ContactCard
            icon={<MessageCircle size={22} color={colors.success} />}
            title="واتساب"
            subtitle={wa}
            action={{ label: 'تحدث معنا', onPress: () => openWhatsApp(wa, 'السلام عليكم، تواصلت معكم من تطبيق سفرة 🍽️') }}
            colors={colors}
          />
        )}
        {phone && (
          <ContactCard
            icon={<Phone size={22} color={colors.primary} />}
            title="هاتف"
            subtitle={phone}
            action={{ label: 'اتصل الآن', onPress: () => Linking.openURL(`tel:${phone}`) }}
            colors={colors}
          />
        )}
        {address && (
          <ContactCard
            icon={<MapPin size={22} color={colors.accent} />}
            title="العنوان"
            subtitle={address}
            colors={colors}
          />
        )}
      </ScrollView>
    </View>
  );
}

function ContactCard({ icon, title, subtitle, action, colors }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: { label: string; onPress: () => void };
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground, textAlign: 'right' }}>{title}</Text>
          <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'right' }}>{subtitle}</Text>
        </View>
      </View>
      {action && <Button variant="outline" size="sm" onPress={action.onPress}>{action.label}</Button>}
    </View>
  );
}
