import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { HeartHandshake, House, Truck, UtensilsCrossed } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeContext';
import { useAppStore } from '@/store';
import { fontFamily, fontSize, gradients, radius, shadow, spacing } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { QUERY_KEYS } from '@/constants';
import { supabase } from '@/lib/supabase';

interface OnboardingPage {
  visual: 'brand' | 'food' | 'delivery';
  title: string;
  subtitle: string;
}

const PAGES: OnboardingPage[] = [
  { visual: 'brand', title: 'سفرة', subtitle: 'من البيت للبيت' },
  { visual: 'food', title: 'أكل بيتي متحضّر بعناية', subtitle: 'مكونات طازة وطعم مصري أصيل، كأن الوجبة خارجة من مطبخ بيتك.' },
  { visual: 'delivery', title: 'اختار، اطلب، واستمتع', subtitle: 'طلب واضح وتوصيل آمن ومتابعة لحد ما سفرتك توصل لباب البيت.' },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [currentPage, setCurrentPage] = useState(0);

  const heroImage = useQuery({
    queryKey: [QUERY_KEYS.BRAND_SETTINGS, 'onboarding-hero'],
    queryFn: async () => {
      const { data } = await supabase.from('brand_settings').select('value').eq('key', 'hero_image_url').maybeSingle();
      return data?.value ?? '';
    },
    staleTime: 5 * 60_000,
  });

  const handleGetStarted = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    if (currentPage === PAGES.length - 1) {
      handleGetStarted();
      return;
    }
    const next = currentPage + 1;
    setCurrentPage(next);
  };

  const isLast = currentPage === PAGES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <OnboardingVisual type={PAGES[currentPage].visual} heroImageUrl={heroImage.data} />
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['4xl'], color: colors.foreground, textAlign: 'center', marginTop: spacing.xl }}>
          {PAGES[currentPage].title}
        </Text>
        <Text style={{ maxWidth: 340, fontFamily: PAGES[currentPage].visual === 'brand' ? fontFamily.semibold : fontFamily.regular, fontSize: PAGES[currentPage].visual === 'brand' ? fontSize.xl : fontSize.lg, color: PAGES[currentPage].visual === 'brand' ? colors.accent : colors.mutedForeground, textAlign: 'center', lineHeight: 29, marginTop: spacing.sm }}>
          {PAGES[currentPage].subtitle}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.lg }}>
        {PAGES.map((page, index) => (
          <View key={page.visual} style={{ width: index === currentPage ? 28 : 8, height: 8, borderRadius: 4, backgroundColor: index === currentPage ? colors.primary : colors.border }} />
        ))}
      </View>

      <View style={{ padding: spacing.xl, paddingTop: 0, gap: spacing.sm }}>
        <Button size="xl" fullWidth onPress={handleNext}>{isLast ? 'ابدأ الطلب' : 'التالي'}</Button>
        {!isLast ? (
          <Pressable onPress={handleGetStarted} style={{ alignItems: 'center', padding: spacing.sm }}>
            <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.mutedForeground }}>تخطّى</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function OnboardingVisual({ type, heroImageUrl }: { type: OnboardingPage['visual']; heroImageUrl?: string }) {
  const { colors } = useTheme();

  if (type === 'brand') {
    return (
      <View style={{ width: 230, height: 230, borderRadius: radius['3xl'], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', ...shadow.md }}>
        <Image source={require('../../assets/images/icon.png')} style={{ width: 184, height: 184, borderRadius: radius['2xl'] }} contentFit="contain" />
      </View>
    );
  }

  if (type === 'food') {
    return (
      <View style={{ width: '100%', maxWidth: 350, height: 280, borderRadius: radius['3xl'], overflow: 'hidden', backgroundColor: colors.surface, ...shadow.md }}>
        <Image source={heroImageUrl ? { uri: heroImageUrl } : require('../../assets/images/placeholder.png')} style={{ width: '100%', height: '100%' }} contentFit={heroImageUrl ? 'cover' : 'contain'} transition={220} />
        <LinearGradient colors={gradients.hero} style={{ position: 'absolute', inset: 0 }} />
        <View style={{ position: 'absolute', right: spacing.md, bottom: spacing.md, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.full, backgroundColor: 'rgba(255,253,248,0.90)' }}>
          <UtensilsCrossed size={16} color="#4A2A1F" />
          <Text style={{ color: '#4A2A1F', fontFamily: fontFamily.bold, fontSize: fontSize.sm }}>متحضّر بحب</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: '100%', maxWidth: 350, height: 250, borderRadius: radius['3xl'], backgroundColor: colors.primarySubtle, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', ...shadow.sm }}>
      <View style={{ width: 250, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
        <VisualStep icon={House} label="البيت" />
        <View style={{ flex: 1, height: 2, marginHorizontal: spacing.sm, backgroundColor: colors.border }} />
        <VisualStep icon={Truck} label="التوصيل" accent />
        <View style={{ flex: 1, height: 2, marginHorizontal: spacing.sm, backgroundColor: colors.border }} />
        <VisualStep icon={HeartHandshake} label="سفرتك" />
      </View>
    </View>
  );
}

function VisualStep({ icon: Icon, label, accent = false }: { icon: typeof House; label: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <View style={{ width: 62, height: 62, borderRadius: 22, backgroundColor: accent ? colors.accent : colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={27} color="#FFFFFF" />
      </View>
      <Text style={{ color: colors.foreground, fontFamily: fontFamily.semibold, fontSize: fontSize.xs }}>{label}</Text>
    </View>
  );
}
