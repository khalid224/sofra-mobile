import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Star, Clock, Plus, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { formatEGP } from '@/utils';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { addFavorite, isFavorite, removeFavorite } from '@/features/favorites/api/favorites.api';
import { QUERY_KEYS } from '@/constants';
import type { Meal } from '@/types';

interface FoodCardProps {
  meal: Meal;
  size?: 'sm' | 'md' | 'lg';
  horizontal?: boolean;
}

export function FoodCard({ meal, size = 'md', horizontal = false }: FoodCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { addItem, hasItem } = useCart();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inCart = hasItem(meal.id);

  // Favorite state query
  const { data: isFav = false } = useQuery({
    queryKey: [QUERY_KEYS.FAVORITES, meal.id, user?.id],
    queryFn: () => (user ? isFavorite(user.id, meal.id) : Promise.resolve(false)),
    enabled: !!user,
    staleTime: 60_000,
  });

  // Favorite toggle mutation
  const favMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (isFav) await removeFavorite(user.id, meal.id);
      else await addFavorite(user.id, meal.id);
    },
    onMutate: async () => {
      // Optimistic update
      const key = [QUERY_KEYS.FAVORITES, meal.id, user?.id];
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData(key, !isFav);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FAVORITES] });
    },
  });

  const handleHeartPress = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!user) { router.push('/auth'); return; }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    favMutation.mutate();
  };

  const handleAdd = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addItem({ meal_id: meal.id, name: meal.name, image_url: meal.image_url, price: meal.price, quantity: 1, notes: '' });
  };

  const imageHeight = size === 'sm' ? 120 : size === 'md' ? 160 : 200;

  if (horizontal) {
    return (
      <Pressable
        onPress={() => router.push(`/food/${meal.id}`)}
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          flexDirection: 'row-reverse',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.borderLight,
          ...shadow.card,
        }}
      >
        <Image source={{ uri: meal.image_url ?? '' }} style={{ width: 100, height: 100 }} contentFit="cover" />
        <View style={{ flex: 1, padding: spacing.sm, justifyContent: 'space-between' }}>
          <Text numberOfLines={2} style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground, textAlign: 'right' }}>
            {meal.name}
          </Text>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
            <Star size={12} color={colors.star} fill={colors.star} />
            <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.mutedForeground }}>
              {meal.rating.toFixed(1)} ({meal.reviews_count})
            </Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize.lg, color: colors.primary }}>
              {formatEGP(meal.price)}
            </Text>
            <Pressable
              onPress={handleAdd}
              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: inCart ? colors.success : colors.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(`/food/${meal.id}`)}
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        overflow: 'hidden',
        flex: 1,
        margin: 6,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...shadow.card,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Image
          source={{ uri: meal.image_url ?? '' }}
          style={{ width: '100%', height: imageHeight }}
          contentFit="cover"
          transition={300}
          placeholder={{ thumbhash: '' }}
        />
        {!meal.is_available && (
          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontFamily: fontFamily.bold, fontSize: fontSize.sm }}>غير متاح</Text>
          </View>
        )}

        {/* Heart / Favorite button — top right */}
        <Pressable
          onPress={handleHeartPress}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Heart
            size={17}
            color={isFav ? '#FF4E6A' : '#fff'}
            fill={isFav ? '#FF4E6A' : 'transparent'}
          />
        </Pressable>

        {/* Add to Cart button — bottom left */}
        <Pressable
          onPress={handleAdd}
          disabled={!meal.is_available}
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: inCart ? colors.success : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.md,
          }}
        >
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>
      <View style={{ padding: spacing.sm, gap: 4 }}>
        <Text numberOfLines={2} style={{ fontFamily: fontFamily.bold, fontSize: size === 'sm' ? fontSize.sm : fontSize.md, color: colors.foreground, textAlign: 'right', lineHeight: 20 }}>
          {meal.name}
        </Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
            <Star size={11} color={colors.star} fill={colors.star} />
            <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.mutedForeground }}>
              {meal.rating.toFixed(1)}
            </Text>
          </View>
          {meal.estimated_preparation_time && (
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
              <Clock size={11} color={colors.mutedForeground} />
              <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground }}>
                {meal.estimated_preparation_time} د
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize.lg, color: colors.primary, textAlign: 'right' }}>
          {formatEGP(meal.price)}
        </Text>
      </View>
    </Pressable>
  );
}
