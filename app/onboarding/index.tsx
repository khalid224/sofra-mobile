import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme/ThemeContext';
import { useAppStore } from '@/store';
import { fontFamily, fontSize, gradients, radius, spacing } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingPage {
  emoji: string;
  title: string;
  subtitle: string;
  bg: string;
}

const PAGES: OnboardingPage[] = [
  {
    emoji: '🍽️',
    title: 'أهلاً في sofra',
    subtitle: 'منصة الأكل البيتي المصري الأصيل. طعام بيتي حقيقي، محضّر بحب، يوصلك لباب بيتك.',
    bg: '#FDF0EB',
  },
  {
    emoji: '👨‍🍳',
    title: 'طباخون محترفون',
    subtitle: 'أمهات وست بيوت متمكنين يحضّرون كل وجبة بعناية فائقة كأنها لأسرتهم.',
    bg: '#FEF9EC',
  },
  {
    emoji: '🚀',
    title: 'توصيل سريع',
    subtitle: 'طلبك يصلك طازة وساخناً في أقل وقت ممكن، من مطبخ بيتنا لباب بيتك.',
    bg: '#F0FDF4',
  },
  {
    emoji: '💯',
    title: 'جودة مضمونة',
    subtitle: 'نحن المسؤولون عن كل طبق. إذا لم يعجبك شيء، نحن هنا لحل أي مشكلة فوراً.',
    bg: '#EFF6FF',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [currentPage, setCurrentPage] = useState(0);
  const listRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentPage < PAGES.length - 1) {
      const next = currentPage + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentPage(next);
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const isLast = currentPage === PAGES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
            <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing['2xl'] }}>
              <Text style={{ fontSize: 70 }}>{item.emoji}</Text>
            </View>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['4xl'], color: colors.foreground, textAlign: 'center', marginBottom: spacing.md }}>
              {item.title}
            </Text>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.lg, color: colors.mutedForeground, textAlign: 'center', lineHeight: 28 }}>
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.lg }}>
        {PAGES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === currentPage ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === currentPage ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>

      {/* Actions */}
      <View style={{ padding: spacing.xl, paddingTop: 0, gap: spacing.sm }}>
        <Button size="xl" fullWidth onPress={handleNext}>
          {isLast ? 'ابدأ الآن' : 'التالي'}
        </Button>
        {!isLast && (
          <Pressable onPress={handleGetStarted} style={{ alignItems: 'center', padding: spacing.sm }}>
            <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.mutedForeground }}>
              تخطّى
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
