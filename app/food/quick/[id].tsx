import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Clock3,
  GripHorizontal,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  X,
} from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

import { useCart } from '@/contexts/CartContext';
import { QUERY_KEYS, MAX_CART_QUANTITY } from '@/constants';
import { fetchAvailableTodayById, fetchMealById } from '@/features/menu/api/meals.api';
import { fetchVariants } from '@/features/menu/api/variants.api';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import type { MealVariant, MealVariantExtra } from '@/types';
import { formatEGP } from '@/utils';

const TABLET_BREAKPOINT = 768;

export default function ProductQuickView() {
  const { id, todaySpecialId } = useLocalSearchParams<{ id: string; todaySpecialId?: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { addItem } = useCart();
  const isTablet = width >= TABLET_BREAKPOINT;
  const drawerWidth = Math.min(480, width * 0.48);
  const minimumHeight = Math.round(height * 0.68);
  const maximumHeight = Math.round(height * 0.92);

  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<MealVariant | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<MealVariantExtra[]>([]);

  const panelHeight = useSharedValue(isTablet ? height : 0);
  const dragStartHeight = useSharedValue(minimumHeight);
  const drawerX = useSharedValue(isTablet ? drawerWidth : 0);
  const backdropOpacity = useSharedValue(0);

  const meal = useQuery({
    queryKey: [QUERY_KEYS.MEAL, id],
    queryFn: () => fetchMealById(id),
    enabled: !!id,
  });
  const variants = useQuery({
    queryKey: [QUERY_KEYS.VARIANTS, id],
    queryFn: () => fetchVariants(id),
    enabled: !!id && !todaySpecialId,
    staleTime: 60_000,
  });
  const todaySpecial = useQuery({
    queryKey: [QUERY_KEYS.AVAILABLE_TODAY, todaySpecialId],
    queryFn: () => fetchAvailableTodayById(todaySpecialId!),
    enabled: !!todaySpecialId,
  });
  const restaurantStatus = useQuery({
    queryKey: [QUERY_KEYS.RESTAURANT_STATUS],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['restaurant_is_open']);
      return (data ?? []).reduce<Record<string, string>>((result, row) => {
        result[row.key] = String(row.value).replace(/^"|"$/g, '');
        return result;
      }, {});
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!variants.data?.length) return;
    setSelectedVariant((current) => current ?? variants.data.find((item) => item.is_default) ?? variants.data[0]);
  }, [variants.data]);

  useEffect(() => {
    const duration = reduceMotion ? 0 : 260;
    backdropOpacity.value = withTiming(1, { duration });
    if (isTablet) {
      panelHeight.value = height;
      drawerX.value = withTiming(0, { duration });
    } else {
      drawerX.value = 0;
      panelHeight.value = withSpring(minimumHeight, {
        damping: 24,
        stiffness: reduceMotion ? 1000 : 260,
        mass: 0.8,
      });
    }
  }, [backdropOpacity, drawerX, height, isTablet, minimumHeight, panelHeight, reduceMotion]);

  const finishClose = useCallback(() => router.back(), [router]);
  const close = useCallback(() => {
    const duration = reduceMotion ? 0 : 190;
    backdropOpacity.value = withTiming(0, { duration });
    if (isTablet) {
      drawerX.value = withTiming(drawerWidth, { duration }, (finished) => {
        if (finished) runOnJS(finishClose)();
      });
    } else {
      panelHeight.value = withTiming(0, { duration }, (finished) => {
        if (finished) runOnJS(finishClose)();
      });
    }
  }, [backdropOpacity, drawerWidth, drawerX, finishClose, isTablet, panelHeight, reduceMotion]);

  const panGesture = useMemo(
    () => Gesture.Pan()
      .enabled(!isTablet)
      .onBegin(() => {
        dragStartHeight.value = panelHeight.value;
      })
      .onUpdate((event) => {
        panelHeight.value = Math.max(0, Math.min(maximumHeight, dragStartHeight.value - event.translationY));
      })
      .onEnd((event) => {
        if (panelHeight.value < minimumHeight * 0.72 || event.velocityY > 1050) {
          panelHeight.value = withTiming(0, { duration: reduceMotion ? 0 : 180 }, (finished) => {
            if (finished) runOnJS(finishClose)();
          });
          backdropOpacity.value = withTiming(0, { duration: reduceMotion ? 0 : 180 });
          return;
        }
        const expand = event.velocityY < -500 || panelHeight.value > (minimumHeight + maximumHeight) / 2;
        panelHeight.value = withSpring(expand ? maximumHeight : minimumHeight, { damping: 24, stiffness: 280 });
      }),
    [backdropOpacity, dragStartHeight, finishClose, isTablet, maximumHeight, minimumHeight, panelHeight, reduceMotion],
  );

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({
    height: isTablet ? height : panelHeight.value,
    transform: [{ translateX: isTablet ? drawerX.value : 0 }],
  }));

  const isSpecial = !!todaySpecialId && !!todaySpecial.data;
  const hasVariants = (variants.data?.length ?? 0) > 0;
  const displayName = isSpecial ? todaySpecial.data.title : meal.data?.name ?? '';
  const displayDescription = isSpecial ? todaySpecial.data.description : meal.data?.description;
  const basePrice = isSpecial ? todaySpecial.data.price : selectedVariant?.price ?? meal.data?.price ?? 0;
  const extrasTotal = selectedExtras.reduce((sum, extra) => sum + extra.price, 0);
  const unitPrice = basePrice + extrasTotal;
  const displayImage = isSpecial
    ? todaySpecial.data.image_url ?? meal.data?.image_url
    : selectedVariant?.image_url ?? meal.data?.image_url;
  const maxStock = isSpecial
    ? todaySpecial.data.quantity
    : selectedVariant?.stock_count ?? MAX_CART_QUANTITY;
  const soldOut = isSpecial
    ? todaySpecial.data.status !== 'available' || todaySpecial.data.quantity <= 0
    : hasVariants && selectedVariant?.stock_count === 0;
  const available = isSpecial
    ? todaySpecial.data.is_active && !soldOut
    : hasVariants
      ? !!selectedVariant?.is_available && !soldOut
      : !!meal.data?.is_available;
  const isLoading = meal.isLoading || (!!todaySpecialId && todaySpecial.isLoading);
  const isError = meal.isError || (!!todaySpecialId && todaySpecial.isError);

  const chooseVariant = (variant: MealVariant) => {
    if (!variant.is_available || variant.stock_count === 0) return;
    setSelectedVariant(variant);
    setSelectedExtras([]);
    setQuantity(1);
  };

  const toggleExtra = (extra: MealVariantExtra) => {
    setSelectedExtras((current) => (
      current.some((item) => item.id === extra.id)
        ? current.filter((item) => item.id !== extra.id)
        : [...current, extra]
    ));
  };

  const openFullDetails = () => {
    router.replace({
      pathname: '/food/[id]',
      params: todaySpecialId ? { id, todaySpecialId } : { id },
    });
  };

  const addToCart = async () => {
    if (!meal.data || !available) return;
    if (restaurantStatus.data?.restaurant_is_open === 'false') {
      Toast.show({ type: 'error', text1: 'المطعم مغلق حاليًا', text2: 'تقدر تضيف طلبك لما نفتح من جديد' });
      return;
    }
    if (hasVariants && !selectedVariant) {
      Toast.show({ type: 'error', text1: 'اختار الحجم أو النوع الأول' });
      return;
    }

    const cartName = selectedVariant ? `${displayName} - ${selectedVariant.name}` : displayName;
    addItem({
      meal_id: meal.data.id,
      name: cartName,
      image_url: displayImage ?? null,
      price: unitPrice,
      quantity,
      notes: '',
      is_today_special: isSpecial,
      today_special_id: todaySpecialId,
      variant_id: selectedVariant?.id,
      variant_name: selectedVariant?.name,
      extras: selectedExtras.map((extra) => ({ id: extra.id, name: extra.name, price: extra.price })),
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    close();
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[{ position: 'absolute', inset: 0 }, backdropStyle]}>
        <BlurView intensity={18} tint={isDark ? 'dark' : 'light'} style={{ position: 'absolute', inset: 0 }} pointerEvents="none" />
        <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlay }} pointerEvents="none" />
        <Pressable accessibilityRole="button" accessibilityLabel="إغلاق تفاصيل الأكلة" onPress={close} style={{ flex: 1 }} />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          {
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: isTablet ? drawerWidth : '100%',
            backgroundColor: colors.card,
            overflow: 'hidden',
            borderTopLeftRadius: isTablet ? radius['3xl'] : radius['2xl'],
            borderBottomLeftRadius: isTablet ? radius['3xl'] : 0,
            borderTopRightRadius: isTablet ? 0 : radius['2xl'],
            ...shadow.lg,
          },
          panelStyle,
        ]}
      >
        {!isTablet ? (
          <GestureDetector gesture={panGesture}>
            <Animated.View
              accessibilityRole="adjustable"
              accessibilityLabel="اسحب لعرض تفاصيل أكثر أو لإغلاق النافذة"
              style={{ height: 30, alignItems: 'center', justifyContent: 'center' }}
            >
              <GripHorizontal size={28} color={colors.foregroundTertiary} />
            </Animated.View>
          </GestureDetector>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إغلاق"
          onPress={close}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: (isTablet ? insets.top : 30) + spacing.compact,
            left: spacing.md,
            zIndex: 5,
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: 'rgba(255,253,248,0.94)',
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.sm,
          }}
        >
          <X size={19} color={colors.foreground} />
        </Pressable>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.compact }}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.medium }}>بنجهز التفاصيل...</Text>
          </View>
        ) : isError || !meal.data ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
            <Text style={{ color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.lg }}>تعذر تحميل الأكلة</Text>
            <Pressable onPress={() => { meal.refetch(); todaySpecial.refetch(); }} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.primarySubtle }}>
              <Text style={{ color: colors.primary, fontFamily: fontFamily.bold }}>حاول تاني</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing.lg }}
            >
              <View style={{ height: isTablet ? 260 : 210, backgroundColor: colors.muted }}>
                <Image source={{ uri: displayImage ?? '' }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={180} />
                <LinearGradient colors={['transparent', 'rgba(15,23,42,0.28)']} style={{ position: 'absolute', inset: 0 }} pointerEvents="none" />
              </View>

              <View style={{ padding: spacing.md, gap: spacing.md }}>
                <View style={{ gap: 5 }}>
                  <Text style={{ color: colors.foreground, fontFamily: fontFamily.extrabold, fontSize: fontSize['3xl'], textAlign: 'right', lineHeight: 34 }}>
                    {displayName}
                  </Text>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                      <Star size={14} color={colors.star} fill={colors.star} />
                      <Text style={{ color: colors.foreground, fontFamily: fontFamily.bold }}>{meal.data.rating.toFixed(1)}</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.regular, fontSize: fontSize.xs }}>({meal.data.reviews_count})</Text>
                    </View>
                    {meal.data.estimated_preparation_time ? (
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                        <Clock3 size={14} color={colors.mutedForeground} />
                        <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>{meal.data.estimated_preparation_time} دقيقة</Text>
                      </View>
                    ) : null}
                  </View>
                  {displayDescription ? (
                    <Text numberOfLines={3} style={{ color: colors.foregroundSecondary, fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'right', lineHeight: 23, marginTop: 3 }}>
                      {displayDescription}
                    </Text>
                  ) : null}
                </View>

                {!isSpecial && hasVariants ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={{ color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.lg, textAlign: 'right' }}>اختار الحجم أو النوع</Text>
                    <View style={{ gap: spacing.sm }}>
                      {variants.data?.map((variant) => {
                        const selected = selectedVariant?.id === variant.id;
                        const disabled = !variant.is_available || variant.stock_count === 0;
                        return (
                          <Pressable
                            key={variant.id}
                            disabled={disabled}
                            onPress={() => chooseVariant(variant)}
                            style={{
                              flexDirection: 'row-reverse',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderWidth: 1.5,
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.primarySubtle : colors.surface,
                              borderRadius: radius.lg,
                              padding: spacing.compact,
                              opacity: disabled ? 0.45 : 1,
                            }}
                          >
                            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
                              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
                              </View>
                              <Text style={{ color: colors.foreground, fontFamily: fontFamily.semibold }}>{variant.name}</Text>
                            </View>
                            <Text style={{ color: colors.primary, fontFamily: fontFamily.bold }}>{formatEGP(variant.price)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {(selectedVariant?.extras?.length ?? 0) > 0 ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={{ color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.lg, textAlign: 'right' }}>إضافات اختيارية</Text>
                    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }}>
                      {selectedVariant?.extras?.map((extra) => {
                        const selected = selectedExtras.some((item) => item.id === extra.id);
                        return (
                          <Pressable
                            key={extra.id}
                            onPress={() => toggleExtra(extra)}
                            style={{
                              flexDirection: 'row-reverse',
                              alignItems: 'center',
                              gap: 5,
                              borderWidth: 1,
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.primarySubtle : colors.surface,
                              borderRadius: radius.full,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                            }}
                          >
                            <Text style={{ color: selected ? colors.primary : colors.foreground, fontFamily: fontFamily.semibold, fontSize: fontSize.sm }}>{extra.name}</Text>
                            {extra.price > 0 ? <Text style={{ color: colors.primary, fontFamily: fontFamily.bold, fontSize: fontSize.xs }}>+{formatEGP(extra.price)}</Text> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.lg }}>الكمية</Text>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, backgroundColor: colors.surface, overflow: 'hidden' }}>
                    <Pressable accessibilityLabel="تقليل الكمية" onPress={() => setQuantity((current) => Math.max(1, current - 1))} style={{ width: 42, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                      <Minus size={17} color={colors.foreground} />
                    </Pressable>
                    <Text style={{ minWidth: 34, textAlign: 'center', color: colors.foreground, fontFamily: fontFamily.bold }}>{quantity}</Text>
                    <Pressable accessibilityLabel="زيادة الكمية" onPress={() => setQuantity((current) => Math.min(current + 1, maxStock || MAX_CART_QUANTITY, MAX_CART_QUANTITY))} style={{ width: 42, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={17} color={colors.foreground} />
                    </Pressable>
                  </View>
                </View>

                <Pressable accessibilityRole="link" onPress={openFullDetails} style={{ alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: 3, paddingVertical: 5 }}>
                  <Text style={{ color: colors.primary, fontFamily: fontFamily.semibold, fontSize: fontSize.sm }}>عرض التفاصيل والتقييمات</Text>
                  <ChevronLeft size={16} color={colors.primary} />
                </Pressable>
              </View>
            </ScrollView>

            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.compact, paddingBottom: Math.max(insets.bottom, spacing.compact), borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.card }}>
              <Pressable
                accessibilityRole="button"
                disabled={!available}
                onPress={addToCart}
                style={{
                  minHeight: 54,
                  borderRadius: radius.lg,
                  backgroundColor: available ? colors.primary : colors.muted,
                  paddingHorizontal: spacing.md,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
                  <ShoppingBag size={19} color={available ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={{ color: available ? colors.primaryForeground : colors.mutedForeground, fontFamily: fontFamily.bold, fontSize: fontSize.md }}>
                    {available ? 'أضف للسلة' : 'غير متاح حاليًا'}
                  </Text>
                </View>
                {available ? <Text style={{ color: colors.primaryForeground, fontFamily: fontFamily.extrabold, fontSize: fontSize.lg }}>{formatEGP(unitPrice * quantity)}</Text> : null}
              </Pressable>
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}
