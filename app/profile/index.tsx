import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Primitives';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/features/profile/api/profile.api';
import { QUERY_KEYS } from '@/constants';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
  });

  const updateMut = useMutation({
    mutationFn: () => updateProfile(user!.id, { full_name: form.full_name, phone: form.phone }),
    onSuccess: async () => {
      await refreshProfile();
      Toast.show({ type: 'success', text1: 'تم تحديث الملف الشخصي' });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: 'حدث خطأ', text2: e.message }),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="الملف الشخصي" showThemeToggle={false} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/* Avatar */}
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize['4xl'], color: colors.primary }}>
              {(profile?.full_name ?? user?.email ?? 'م')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground, marginTop: spacing.sm }}>
            {profile?.full_name ?? 'مستخدم sofra'}
          </Text>
          <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground }}>
            {user?.email}
          </Text>
        </View>

        {/* Edit form */}
        <View style={{ backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderLight }}>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, textAlign: 'right' }}>
            تعديل البيانات
          </Text>

          <View>
            <Label>الاسم بالكامل</Label>
            <Input
              value={form.full_name}
              onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))}
              placeholder="اسمك الكامل"
            />
          </View>

          <View>
            <Label>رقم الموبايل</Label>
            <Input
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="01xxxxxxxxx"
              keyboardType="phone-pad"
            />
          </View>

          <Button size="lg" fullWidth loading={updateMut.isPending} onPress={() => updateMut.mutate()}>
            حفظ التغييرات
          </Button>
        </View>

        {/* Account info */}
        <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderLight }}>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, textAlign: 'right' }}>
            معلومات الحساب
          </Text>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fontFamily.regular, color: colors.mutedForeground }}>البريد الإلكتروني</Text>
            <Text style={{ fontFamily: fontFamily.medium, color: colors.foreground }}>{user?.email ?? '—'}</Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fontFamily.regular, color: colors.mutedForeground }}>نوع الحساب</Text>
            <Text style={{ fontFamily: fontFamily.medium, color: colors.foreground }}>
              {profile?.role === 'admin' ? 'مدير' : 'عميل'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
