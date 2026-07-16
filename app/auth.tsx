import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input, Label, Divider } from '@/components/ui/Primitives';
import { useAuth } from '@/contexts/AuthContext';
import { validateEmail } from '@/utils';

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import * as Linking from "expo-linking";

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'login' | 'register';

export default function AuthScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {

      const redirectUrl = Linking.createURL("", {
        scheme: "sofra",
      });
      console.log("Redirect URL:", redirectUrl);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          // Parse hash fragments
          const hashIndex = result.url.indexOf('#');
          if (hashIndex !== -1) {
            const hash = result.url.substring(hashIndex + 1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (accessToken && refreshToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionError) throw sessionError;
              Toast.show({ type: 'success', text1: 'مرحباً بك!', text2: 'تم تسجيل الدخول بنجاح' });
              router.replace('/(tabs)');
              return;
            }
          }
          // Fallback if hash parameter is not present directly
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            Toast.show({ type: 'success', text1: 'مرحباً بك!', text2: 'تم تسجيل الدخول بنجاح' });
            router.replace('/(tabs)');
          }
        }
      }
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'خطأ في تسجيل الدخول',
        text2: e instanceof Error ? e.message : 'فشل الاتصال بجوجل',
      });
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const errs: Partial<typeof form> = {};
    if (mode === 'register' && form.fullName.trim().length < 2) errs.fullName = 'الاسم مطلوب';
    if (!validateEmail(form.email)) errs.email = 'البريد الإلكتروني غير صحيح';
    if (form.password.length < 6) errs.password = 'كلمة السر 6 أحرف على الأقل';
    if (mode === 'register' && form.password !== form.confirm) errs.confirm = 'كلمتا السر غير متطابقتين';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithPassword(form.email.trim(), form.password);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        await signUpWithPassword(form.email.trim(), form.password, form.fullName.trim());
        Toast.show({ type: 'success', text1: 'تم إنشاء الحساب', text2: 'يرجى التحقق من بريدك الإلكتروني' });
        setMode('login');
      }
    } catch (e: unknown) {
      Toast.show({ type: 'error', text1: 'حدث خطأ', text2: e instanceof Error ? e.message : 'حاول مجدداً' });
    } finally {
      setLoading(false);
    }
  };

  const update = (field: keyof typeof form) => (val: string) => {
    setForm((f) => ({ ...f, [field]: val }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="" showThemeToggle={false} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.lg }}>
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.lg, marginBottom: spacing.md }}>
              <Text style={{ color: '#fff', fontFamily: fontFamily.extrabold, fontSize: fontSize['3xl'] }}>S</Text>
            </View>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['3xl'], color: colors.foreground }}>sofra</Text>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.mutedForeground, marginTop: 4 }}>
              {mode === 'login' ? 'أهلاً بعودتك' : 'أنشئ حسابك الجديد'}
            </Text>
          </View>

          {/* Google Sign-In button */}
          <Button variant="outline" size="lg" fullWidth loading={loading} onPress={handleGoogleSignIn}
            style={{ marginBottom: spacing.md }}>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground }}>المتابعة بحساب Google</Text>
          </Button>

          <Divider label="أو بالبريد الإلكتروني" />
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {mode === 'register' && (
              <View>
                <Label required>الاسم بالكامل</Label>
                <Input value={form.fullName} onChangeText={update('fullName')} placeholder="محمد أحمد" error={errors.fullName} />
              </View>
            )}
            <View>
              <Label required>البريد الإلكتروني</Label>
              <Input value={form.email} onChangeText={update('email')} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
            </View>
            <View>
              <Label required>كلمة السر</Label>
              <Input value={form.password} onChangeText={update('password')} placeholder="••••••••" secureTextEntry error={errors.password} />
            </View>
            {mode === 'register' && (
              <View>
                <Label required>تأكيد كلمة السر</Label>
                <Input value={form.confirm} onChangeText={update('confirm')} placeholder="••••••••" secureTextEntry error={errors.confirm} />
              </View>
            )}

            <Button size="lg" fullWidth loading={loading} onPress={handleSubmit} style={{ marginTop: spacing.sm }}>
              {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
            </Button>

            <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrors({}); }} style={{ paddingVertical: spacing.sm }}>
              <Text style={{ textAlign: 'center', fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.primary }}>
                {mode === 'login' ? 'مستخدم جديد؟ أنشئ حساباً الآن' : 'لديك حساب؟ سجّل الدخول'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
