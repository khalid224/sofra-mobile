import { useState, useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Clock, Minus, Plus, ShoppingCart, Star, AlertTriangle, Zap, Heart } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Primitives';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { StarRating } from '@/components/shared/StarRating';
import { FoodCard } from '@/components/shared/FoodCard';
import { fetchMealById, fetchSimilarMeals, fetchAvailableTodayById } from '@/features/menu/api/meals.api';
import { fetchMealReviews as fetchReviews } from '@/features/reviews/api/reviews.api';
import { addFavorite, isFavorite, removeFavorite } from '@/features/favorites/api/favorites.api';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatEGP } from '@/utils';
import { QUERY_KEYS, MAX_CART_QUANTITY } from '@/constants';
import type { Meal, AvailableToday } from '@/types';
import { supabase } from '@/lib/supabase';

export default function FoodDetailScreen() {
  const { id, todaySpecialId } = useLocalSearchParams<{ id: string; todaySpecialId?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem, getItem } = useCart();
  
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [activeImage, setActiveImage] = useState(0);

  // Queries
  const meal = useQuery({ 
    queryKey: [QUERY_KEYS.MEAL, id], 
    queryFn: () => fetchMealById(id!), 
    enabled: !!id 
  });

  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Favorite state query
  const { data: isFav = false } = useQuery({
    queryKey: [QUERY_KEYS.FAVORITES, id, user?.id],
    queryFn: () => (user && id ? isFavorite(user.id, id) : Promise.resolve(false)),
    enabled: !!user && !!id,
    staleTime: 60_000,
  });

  // Favorite toggle mutation
  const favMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) return;
      if (isFav) await removeFavorite(user.id, id);
      else await addFavorite(user.id, id);
    },
    onMutate: async () => {
      const key = [QUERY_KEYS.FAVORITES, id, user?.id];
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData(key, !isFav);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FAVORITES] });
    },
  });

  const handleHeartPress = async () => {
    if (!user) { router.push('/auth'); return; }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    favMutation.mutate();
  };

  const todaySpecial = useQuery({
    queryKey: [QUERY_KEYS.AVAILABLE_TODAY, todaySpecialId],
    queryFn: () => fetchAvailableTodayById(todaySpecialId!),
    enabled: !!todaySpecialId
  });

  const similar = useQuery({
    queryKey: ['similar', meal.data?.subcategory_id],
    queryFn: () => fetchSimilarMeals(meal.data!.subcategory_id, id!),
    enabled: !!meal.data?.subcategory_id,
  });

  const reviews = useQuery({
    queryKey: [QUERY_KEYS.REVIEWS, id],
    queryFn: () => fetchReviews(id!),
    enabled: !!id,
  });

  const restaurantStatus = useQuery({
    queryKey: [QUERY_KEYS.RESTAURANT_STATUS],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['restaurant_is_open', 'restaurant_closed_msg']);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => {
        map[r.key] = String(r.value).replace(/^"|"$/g, '');
      });
      return map;
    },
    staleTime: 60_000,
  });

  const isOpen = restaurantStatus.data?.restaurant_is_open !== 'false';
  const closedMsg = restaurantStatus.data?.restaurant_closed_msg ?? 'المطعم مغلق حالياً';

  // Derived Properties
  const isSpecial = !!todaySpecialId && !!todaySpecial.data;
  
  const displayName = isSpecial ? todaySpecial.data.title : (meal.data?.name ?? '');
  const displayDescription = isSpecial ? todaySpecial.data.description : (meal.data?.description ?? null);
  const displayPrice = isSpecial ? todaySpecial.data.price : (meal.data?.price ?? 0);
  
  // Use snapshot image if available
  const snapshotImage = isSpecial ? todaySpecial.data.image_url : null;
  const images = meal.data 
    ? [snapshotImage || meal.data.image_url, ...(meal.data.gallery ?? [])].filter(Boolean) as string[] 
    : (snapshotImage ? [snapshotImage] : []);

  // Limit quantity to special's remaining stock or global max
  const maxStock = isSpecial ? todaySpecial.data.quantity : MAX_CART_QUANTITY;
  const isSoldOut = isSpecial && todaySpecial.data.status === 'sold_out';
  const isExpired = isSpecial && todaySpecial.data.status === 'expired';
  const isAvailable = isSpecial 
    ? (todaySpecial.data.is_active && !isSoldOut && !isExpired) 
    : (meal.data?.is_available ?? false);

  const inCart = meal.data ? getItem(meal.data.id) : undefined;

  const handleAddToCart = async () => {
    if (!meal.data) return;
    if (!isOpen) {
      Toast.show({ type: 'error', text1: 'عذراً، المطعم مغلق حالياً', text2: 'لا يمكن استقبال طلبات جديدة' });
      return;
    }
    if (isSpecial && quantity > maxStock) {
      Toast.show({ type: 'error', text1: 'الكمية غير كافية', text2: `المتبقي في المخزون ${maxStock} فقط` });
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    addItem({ 
      meal_id: meal.data.id, 
      name: displayName, 
      image_url: images[0] ?? null, 
      price: displayPrice, 
      quantity, 
      notes,
      is_today_special: isSpecial,
      today_special_id: todaySpecialId
    });
    
    Toast.show({ type: 'success', text1: 'تمت الإضافة للسلة ✓', text2: `${displayName} × ${quantity}` });
  };

  if (meal.isError || (todaySpecialId && todaySpecial.isError)) {
    return <ErrorState onRetry={() => { meal.refetch(); todaySpecial.refetch(); }} />;
  }

  const isLoading = meal.isLoading || (!!todaySpecialId && todaySpecial.isLoading);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Floating Header */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingTop: insets.top + 8, paddingHorizontal: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={handleHeartPress} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', ...shadow.md }}>
          <Heart size={20} color={isFav ? '#FF4E6A' : '#000'} fill={isFav ? '#FF4E6A' : 'transparent'} />
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', ...shadow.md }}>
          <Text style={{ fontSize: 18, color: '#000' }}>←</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={{ height: 320, backgroundColor: colors.muted }}>
          {isLoading ? (
            <Skeleton width="100%" height={320} borderRadius={0} />
          ) : (
            <Image source={{ uri: images[activeImage] ?? '' }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
          )}
        </View>

        {/* Gallery Dots */}
        {images.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            {images.map((_, i) => (
              <Pressable key={i} onPress={() => setActiveImage(i)}
                style={{ width: i === activeImage ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === activeImage ? colors.primary : colors.border }} />
            ))}
          </View>
        )}

        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={28} width="70%" />
              <Skeleton height={16} width="50%" />
              <Skeleton height={20} width="40%" />
            </View>
          ) : meal.data ? (
            <>
              {/* Category & Title */}
              <View>
                {meal.data.subcategory && (
                  <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'right' }}>
                    {meal.data.subcategory.category?.name} / {meal.data.subcategory.name}
                  </Text>
                )}
                
                {/* Specials Badging */}
                {isSpecial && (
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Badge tone="warning" size="sm">
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
                        <Zap size={10} color="#b45309" />
                        <Text style={{ fontSize: 10, color: '#b45309', fontFamily: fontFamily.bold }}>عرض اليوم الخاص</Text>
                      </View>
                    </Badge>
                    {isSoldOut && <Badge tone="destructive" size="sm">نفذت الكمية</Badge>}
                    {isExpired && <Badge tone="muted" size="sm">انتهى العرض</Badge>}
                  </View>
                )}

                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['4xl'], color: colors.foreground, textAlign: 'right', marginTop: 6, lineHeight: 38 }}>
                  {displayName}
                </Text>
              </View>

              {/* Stats Row */}
              <View style={{ flexDirection: 'row-reverse', gap: spacing.md, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                  <Star size={14} color={colors.star} fill={colors.star} />
                  <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground }}>{meal.data.rating.toFixed(1)}</Text>
                  <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground }}>({meal.data.reviews_count})</Text>
                </View>
                {meal.data.estimated_preparation_time && (
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                    <Clock size={14} color={colors.mutedForeground} />
                    <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground }}>{meal.data.estimated_preparation_time} دقيقة</Text>
                  </View>
                )}
                {meal.data.calories && (
                  <Badge tone="muted">{meal.data.calories} سعرة</Badge>
                )}
              </View>

              {/* Price */}
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['4xl'], color: colors.primary, textAlign: 'right' }}>
                  {formatEGP(displayPrice)}
                </Text>
                {isSpecial && !isSoldOut && !isExpired && (
                  <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.mutedForeground }}>
                    المتبقي في المخزون: {todaySpecial.data.quantity}
                  </Text>
                )}
              </View>

              {/* Description */}
              {displayDescription && (
                <View style={{ backgroundColor: colors.muted, borderRadius: radius.xl, padding: spacing.md }}>
                  <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.foreground, textAlign: 'right', lineHeight: 26 }}>
                    {displayDescription}
                  </Text>
                </View>
              )}

              {/* Quantity Select */}
              {isAvailable && isOpen && (
                <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: colors.foreground }}>الكمية:</Text>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.full, overflow: 'hidden' }}>
                      <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Minus size={16} color={colors.foreground} />
                      </Pressable>
                      <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, minWidth: 28, textAlign: 'center' }}>{quantity}</Text>
                      <Pressable onPress={() => setQuantity((q) => Math.min(q + 1, maxStock))} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Plus size={16} color={colors.foreground} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </>
          ) : null}

          {/* Customer Reviews */}
          {(reviews.data?.length ?? 0) > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground, textAlign: 'right', marginBottom: spacing.sm }}>
                تقييمات العملاء
              </Text>
              {reviews.data?.slice(0, 3).map((r) => (
                <View key={r.id} style={{ backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderLight }}>
                  <StarRating rating={r.rating} size={14} />
                  {r.comment && (
                    <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.foreground, textAlign: 'right', marginTop: 6 }}>
                      {r.comment}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Similar Meals */}
          {(similar.data?.length ?? 0) > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground, textAlign: 'right', marginBottom: spacing.sm }}>
                قد يعجبك أيضاً
              </Text>
              <View style={{ flexDirection: 'row' }}>
                {similar.data?.slice(0, 2).map((m) => <FoodCard key={m.id} meal={m} />)}
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky Bottom Actions */}
      {!isLoading && isAvailable && isOpen && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border, padding: spacing.md, paddingBottom: insets.bottom + spacing.md, ...shadow.lg }}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['2xl'], color: colors.primary }}>
              {formatEGP(displayPrice * quantity)}
            </Text>
            {inCart && (
              <Badge tone="success">في السلة ({inCart.quantity})</Badge>
            )}
          </View>
          <Button size="lg" fullWidth onPress={handleAddToCart} leftIcon={<ShoppingCart size={18} color="#fff" />}>
            أضف للسلة
          </Button>
        </View>
      )}

      {/* Closed Restaurant Status Banner */}
      {!isLoading && isAvailable && !isOpen && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, padding: spacing.md, paddingBottom: insets.bottom + spacing.md, ...shadow.lg, borderTopWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 6 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={18} color="#ef4444" />
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: '#ef4444' }}>المطعم مغلق حالياً</Text>
          </View>
          <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground }}>{closedMsg}</Text>
        </View>
      )}

      {/* Unavailable Status Banner */}
      {!isLoading && !isAvailable && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, padding: spacing.md, paddingBottom: insets.bottom + spacing.md, ...shadow.lg, borderTopWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
          <Badge tone="destructive" size="md">
            {isExpired ? 'انتهى هذا العرض اليومي' : isSoldOut ? 'نفذت كمية هذا العرض اليومي' : 'هذا الصنف غير متاح حالياً'}
          </Badge>
        </View>
      )}
    </View>
  );
}
