import { Linking, ScrollView, Switch, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ExternalLink, Info, Moon, Shield, Sun, Bell } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Divider } from '@/components/ui/Primitives';
import { fetchSettings } from '@/features/home/api/settings.api';
import { useAuth } from '@/contexts/AuthContext';
import { fetchNotificationPreferences, upsertNotificationPreferences } from '@/features/notifications/api/notificationPreferences.api';
import { QUERY_KEYS } from '@/constants';

export default function SettingsScreen() {
  const { colors, isDark, setMode } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  
  const settings = useQuery({ 
    queryKey: [QUERY_KEYS.SETTINGS], 
    queryFn: fetchSettings, 
    staleTime: 300_000 
  });

  const { data: prefs, refetch: refetchPrefs } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: () => (user ? fetchNotificationPreferences(user.id) : Promise.resolve(null)),
    enabled: !!user,
  });

  const privacyUrl = (settings.data?.privacy_policy_url as string | undefined) ?? 'https://sofra.eg/privacy';
  const termsUrl = (settings.data?.terms_url as string | undefined) ?? 'https://sofra.eg/terms';

  const togglePref = async (key: 'notify_specials' | 'notify_orders' | 'notify_chat' | 'notify_promos') => {
    if (!user) return;
    const currentVal = prefs ? prefs[key] : true; // Default to true if not set
    try {
      await upsertNotificationPreferences(user.id, { [key]: !currentVal });
      await refetchPrefs();
    } catch (e) {
      console.error('[Settings] Error updating notification preferences:', e);
    }
  };

  const sections: { 
    title: string; 
    show?: boolean; 
    items: { label: string; onPress?: () => void; right?: React.ReactNode; icon?: React.ReactNode }[] 
  }[] = [
    {
      title: 'المظهر',
      show: true,
      items: [
        {
          label: isDark ? 'الوضع الداكن (مفعّل)' : 'الوضع الداكن',
          icon: isDark ? <Moon size={18} color={colors.primary} /> : <Sun size={18} color={colors.foreground} />,
          right: (
            <Switch
              value={isDark}
              onValueChange={(val) => setMode(val ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          ),
        },
      ],
    },
    {
      title: 'تفضيلات الإشعارات',
      show: !!user,
      items: [
        {
          label: 'عروض اليوم المتاحة',
          icon: <Bell size={18} color={colors.foreground} />,
          right: (
            <Switch
              value={prefs ? prefs.notify_specials : true}
              onValueChange={() => togglePref('notify_specials')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          ),
        },
        {
          label: 'تحديثات وحالة الطلبات',
          icon: <Bell size={18} color={colors.foreground} />,
          right: (
            <Switch
              value={prefs ? prefs.notify_orders : true}
              onValueChange={() => togglePref('notify_orders')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          ),
        },
        {
          label: 'رسائل الدردشة',
          icon: <Bell size={18} color={colors.foreground} />,
          right: (
            <Switch
              value={prefs ? prefs.notify_chat : true}
              onValueChange={() => togglePref('notify_chat')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          ),
        },
        {
          label: 'العروض والخصومات الترويجية',
          icon: <Bell size={18} color={colors.foreground} />,
          right: (
            <Switch
              value={prefs ? prefs.notify_promos : true}
              onValueChange={() => togglePref('notify_promos')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          ),
        },
      ],
    },
    {
      title: 'معلومات قانونية',
      show: true,
      items: [
        {
          label: 'سياسة الخصوصية',
          icon: <Shield size={18} color={colors.foreground} />,
          onPress: () => Linking.openURL(privacyUrl),
          right: <ExternalLink size={16} color={colors.mutedForeground} />,
        },
        {
          label: 'الشروط والأحكام',
          icon: <Info size={18} color={colors.foreground} />,
          onPress: () => Linking.openURL(termsUrl),
          right: <ExternalLink size={16} color={colors.mutedForeground} />,
        },
      ],
    },
    {
      title: 'تواصل معنا',
      show: true,
      items: [
        {
          label: 'اتصل بنا',
          onPress: () => router.push('/contact'),
          right: <ChevronLeft size={16} color={colors.mutedForeground} />,
        },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="الإعدادات" showThemeToggle={false} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}>
        {sections.filter(s => s.show !== false).map((section) => (
          <View key={section.title}>
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'right', marginBottom: spacing.sm, paddingHorizontal: 4 }}>
              {section.title}
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
              {section.items.map((item, idx, arr) => (
                <View key={item.label}>
                  <Pressable
                    onPress={item.onPress}
                    style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md }}
                  >
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
                      {item.icon}
                      <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.foreground }}>
                        {item.label}
                      </Text>
                    </View>
                    {item.right}
                  </Pressable>
                  {idx < arr.length - 1 && <Divider />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* App version */}
        <Text style={{ textAlign: 'center', fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: spacing.sm }}>
          سفرة v1.0.0 — جميع الحقوق محفوظة
        </Text>
      </ScrollView>
    </View>
  );
}
