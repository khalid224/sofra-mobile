import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  FileText,
  Heart,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Star,
  Sun,
  User,
} from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, gradients, radius, shadow, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAuth } from '@/contexts/AuthContext';
import { removeToken } from '@/features/notifications/hooks/useNotifications';

export default function AccountScreen() {
  const { colors, isDark, setMode } = useTheme();
  const { profile, isAdmin, signOut, user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await removeToken().catch(() => undefined);
    await signOut().catch(() => undefined);
  };

  const menuItems = [
    { icon: User, label: 'الملف الشخصي', caption: 'بياناتك الشخصية', onPress: () => router.push('/profile'), show: !!user },
    { icon: MapPin, label: 'عناويني', caption: 'عناوين التوصيل المحفوظة', onPress: () => router.push('/profile/addresses'), show: !!user },
    { icon: ShoppingBag, label: 'سلة المشتريات', caption: 'راجع طلبك الحالي', onPress: () => router.navigate('/(tabs)/cart'), show: true },
    { icon: Heart, label: 'المفضلة', caption: 'الأصناف اللي عجبتك', onPress: () => router.push('/favorites'), show: !!user },
    { icon: MessageCircle, label: 'المحادثات', caption: 'تواصل مع فريق sofra', onPress: () => router.push('/chat'), show: !!user },
    { icon: Star, label: 'تقييماتي', caption: 'شاركنا رأيك', onPress: () => router.push('/reviews'), show: !!user },
    { icon: FileText, label: 'الشكاوى', caption: 'تابع طلبات الدعم', onPress: () => router.push('/complaints'), show: !!user },
    { icon: Settings2, label: 'الإعدادات', caption: 'التفضيلات والخصوصية', onPress: () => router.push('/settings'), show: true },
    { icon: Phone, label: 'اتصل بنا', caption: 'إحنا هنا لمساعدتك', onPress: () => router.push('/contact'), show: true },
    { icon: ShieldCheck, label: 'لوحة الإدارة', caption: 'إدارة التطبيق والطلبات', onPress: () => router.push('/admin'), show: isAdmin, admin: true },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="حسابي" showThemeToggle={false} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.md, paddingBottom: 104 }}>
        {user ? (
          <LinearGradient colors={gradients.primary} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ borderRadius: radius['2xl'], padding: spacing.lg, overflow: 'hidden', ...shadow.md }}>
            <View style={{ position: 'absolute', left: -30, top: -45, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 68, height: 68, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.extrabold, fontSize: fontSize['3xl'] }}>{(profile?.full_name ?? user.email ?? 'م')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'right' }}>{profile?.full_name ?? 'مستخدم sofra'}</Text>
                <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.78)', fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'right', marginTop: 3 }}>{user.email ?? user.phone ?? ''}</Text>
                {isAdmin ? <View style={{ alignSelf: 'flex-end', marginTop: spacing.sm, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.16)' }}><Text style={{ color: '#FFFFFF', fontFamily: fontFamily.semibold, fontSize: 10 }}>مدير النظام</Text></View> : null}
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={{ backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.lg, alignItems: 'center', gap: spacing.compact, borderWidth: 1, borderColor: colors.border, ...shadow.card }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}><User size={28} color={colors.primary} /></View>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground }}>أهلًا بيك في sofra</Text>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'center' }}>سجّل دخولك لمتابعة الطلبات وحفظ المفضلة والعناوين</Text>
            <Button fullWidth onPress={() => router.push('/auth')}>تسجيل الدخول أو إنشاء حساب</Button>
          </View>
        )}

        <Text style={{ marginTop: spacing.lg, marginBottom: spacing.compact, fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, textAlign: 'right' }}>حسابك وخدماتك</Text>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.compact, ...shadow.sm }}>
          {menuItems.filter((item) => item.show).map((item, index, visible) => (
            <PressableScale
              key={item.label}
              onPress={item.onPress}
              contentStyle={{ paddingVertical: spacing.compact, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.compact, borderBottomWidth: index === visible.length - 1 ? 0 : 1, borderBottomColor: colors.borderLight }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: item.admin ? colors.accentSubtle : colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
                <item.icon size={19} color={item.admin ? colors.accent : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: item.admin ? colors.accent : colors.foreground, textAlign: 'right' }}>{item.label}</Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 10, color: colors.mutedForeground, textAlign: 'right', marginTop: 2 }}>{item.caption}</Text>
              </View>
              <ChevronLeft size={17} color={colors.foregroundTertiary} />
            </PressableScale>
          ))}
        </View>

        <Pressable
          onPress={() => setMode(isDark ? 'light' : 'dark')}
          style={{ marginTop: spacing.compact, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.compact }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
              {isDark ? <Sun size={19} color={colors.warning} /> : <Moon size={19} color={colors.primary} />}
            </View>
            <View>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.foreground }}>{isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</Text>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: 10, color: colors.mutedForeground }}>غيّر مظهر التطبيق</Text>
            </View>
          </View>
          <ChevronLeft size={17} color={colors.foregroundTertiary} />
        </Pressable>

        {user ? (
          <Pressable onPress={handleSignOut} style={{ marginTop: spacing.lg, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.destructive + '30', backgroundColor: colors.destructiveSubtle, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' }}>
            <LogOut size={17} color={colors.destructive} />
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.destructive }}>تسجيل الخروج</Text>
          </Pressable>
        ) : null}

        <Text style={{ marginTop: spacing.lg, textAlign: 'center', fontFamily: fontFamily.regular, fontSize: 10, color: colors.foregroundTertiary }}>sofra v1.0.0 · معمول بحب في مصر</Text>
      </ScrollView>
    </View>
  );
}
