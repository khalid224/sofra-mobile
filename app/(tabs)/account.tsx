import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Heart, LogOut, MapPin, MessageCircle, Moon, Settings2, ShieldCheck, ShoppingCart, Star, Sun, User, FileText, Phone } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Primitives';
import { useAuth } from '@/contexts/AuthContext';
import { removeToken } from '@/features/notifications/hooks/useNotifications';

export default function AccountScreen() {
  const { colors, isDark, setMode } = useTheme();
  const { profile, isAdmin, signOut, user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      // Remove push token before signing out
      await signOut();
    } catch {
      // ignore
    }
  };

  const menuItems = [
    { icon: User, label: 'الملف الشخصي', onPress: () => router.push('/profile'), show: !!user },
    { icon: MapPin, label: 'عناويني', onPress: () => router.push('/profile/addresses'), show: !!user },
    { icon: MessageCircle, label: 'محادثاتي', onPress: () => router.push('/chat'), show: !!user },
    { icon: Star, label: 'تقييماتي', onPress: () => router.push('/reviews'), show: !!user },
    { icon: FileText, label: 'شكاواي', onPress: () => router.push('/complaints'), show: !!user },
    { icon: ShoppingCart, label: 'السلة', onPress: () => router.push('/(tabs)/cart'), show: true },
    { icon: Heart, label: 'المفضلة', onPress: () => router.push('/favorites'), show: !!user },
    { icon: Settings2, label: 'الإعدادات', onPress: () => router.push('/settings'), show: true },
    { icon: ShieldCheck, label: 'لوحة الإدارة', onPress: () => router.push('/admin'), show: isAdmin },
    { icon: Phone, label: 'اتصل بنا', onPress: () => router.push('/contact'), show: true },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="حسابي" showThemeToggle={false} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}>

        {/* Profile card */}
        {user ? (
          <View style={{ backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.md, ...shadow.sm, borderWidth: 1, borderColor: colors.borderLight }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], color: colors.primary }}>
                  {(profile?.full_name ?? user.email ?? 'م')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground, textAlign: 'right' }}>
                  {profile?.full_name ?? 'مستخدم sofra'}
                </Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'right' }}>
                  {user.email ?? user.phone ?? ''}
                </Text>
                {isAdmin && (
                  <View style={{ alignSelf: 'flex-end', backgroundColor: colors.primarySubtle, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2, marginTop: 4 }}>
                    <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.xs, color: colors.primary }}>مدير النظام</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.lg, alignItems: 'center', gap: spacing.md, ...shadow.sm }}>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground }}>مرحباً بك</Text>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.mutedForeground, textAlign: 'center' }}>
              سجّل دخولك لمتابعة طلباتك وإدارة حسابك
            </Text>
            <Button fullWidth onPress={() => router.push('/auth')}>تسجيل الدخول</Button>
            <Button fullWidth variant="outline" onPress={() => router.push('/auth')}>إنشاء حساب جديد</Button>
          </View>
        )}

        {/* Theme toggle card */}
        <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
          <Pressable
            onPress={() => setMode(isDark ? 'light' : 'dark')}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md }}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
              {isDark ? <Sun size={20} color={colors.foreground} /> : <Moon size={20} color={colors.foreground} />}
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: colors.foreground }}>
                {isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
              </Text>
            </View>
            <ChevronLeft size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Menu items */}
        <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
          {menuItems.filter((i) => i.show).map((item, idx, arr) => (
            <View key={item.label}>
              <Pressable
                onPress={item.onPress}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md }}
              >
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
                  <item.icon size={20} color={item.label === 'لوحة الإدارة' ? colors.primary : colors.foreground} />
                  <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: item.label === 'لوحة الإدارة' ? colors.primary : colors.foreground }}>
                    {item.label}
                  </Text>
                </View>
                <ChevronLeft size={18} color={colors.mutedForeground} />
              </Pressable>
              {idx < arr.length - 1 && <Divider />}
            </View>
          ))}
        </View>

        {user && (
          <Button variant="outline" size="lg" fullWidth onPress={handleSignOut} leftIcon={<LogOut size={18} color={colors.destructive} />}>
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: colors.destructive }}>تسجيل الخروج</Text>
          </Button>
        )}

        <Text style={{ textAlign: 'center', fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground }}>
          sofra v1.0.0 — أكل بيتي بحب ❤️
        </Text>
      </ScrollView>
    </View>
  );
}
