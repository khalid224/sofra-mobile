import type { GestureResponderEvent } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Clock3, Heart, Plus, Star } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { formatEGP } from '@/utils';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { addFavorite, fetchFavoriteMealIds, removeFavorite } from '@/features/favorites/api/favorites.api';
import { QUERY_KEYS } from '@/constants';
import { PressableScale } from '@/components/ui/PressableScale';
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
  const addScale = useSharedValue(1);
  const inCart = hasItem(meal.id);

  const addAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: addScale.value }] }));

  const { data: favoriteMealIds = [] } = useQuery({
    queryKey: [QUERY_KEYS.FAVORITES, 'ids', user?.id],
    queryFn: () => (user ? fetchFavoriteMealIds(user.id) : Promise.resolve([])),
    enabled: !!user,
    staleTime: 60_000,
  });
  const isFav = favoriteMealIds.includes(meal.id);

  const favMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (isFav) await removeFavorite(user.id, meal.id);
      else await addFavorite(user.id, meal.id);
    },
    onMutate: async () => {
      const key = [QUERY_KEYS.FAVORITES, 'ids', user?.id];
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<string[]>(key, (current = []) =>
        isFav ? current.filter((id) => id !== meal.id) : [...current, meal.id],
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FAVORITES] }),
  });

  const handleHeartPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!user) {
      router.push('/auth');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    favMutation.mutate();
  };

  const handleAdd = (event: GestureResponderEvent) => {
    event.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    addScale.value = withSequence(withSpring(1.22), withSpring(1));
    if (meal.variants?.length) {
      router.push({ pathname: '/food/quick/[id]', params: { id: meal.id } });
      return;
    }
    addItem({ meal_id: meal.id, name: meal.name, image_url: meal.image_url, price: meal.price, quantity: 1, notes: '' });
  };

  if (horizontal) {
    return (
      <PressableScale
        onPress={() => router.push({ pathname: '/food/quick/[id]', params: { id: meal.id } })}
        style={{ width: 292, marginLeft: spacing.compact }}
        contentStyle={{
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          flexDirection: 'row-reverse',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          ...shadow.card,
        }}
      >
        <Image source={{ uri: meal.image_url ?? '' }} style={{ width: 112, minHeight: 132 }} contentFit="cover" transition={180} />
        <View style={{ flex: 1, padding: spacing.compact, justifyContent: 'space-between', gap: 6 }}>
          <View>
            <Text numberOfLines={2} style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground, textAlign: 'right', lineHeight: 22 }}>
              {meal.name}
            </Text>
            {meal.description ? (
              <Text numberOfLines={1} style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: 'right', marginTop: 2 }}>
                {meal.description}
              </Text>
            ) : null}
          </View>
          <MetaRow meal={meal} colors={colors} />
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.primary }}>{formatEGP(meal.price)}</Text>
            <AddButton onPress={handleAdd} active={inCart} colors={colors} animatedStyle={addAnimatedStyle} />
          </View>
        </View>
      </PressableScale>
    );
  }

  const imageHeight = size === 'sm' ? 124 : size === 'lg' ? 196 : 154;

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/food/quick/[id]', params: { id: meal.id } })}
      disabled={!meal.is_available}
      style={{ flex: 1, margin: 6 }}
      contentStyle={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        ...shadow.card,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Image source={{ uri: meal.image_url ?? '' }} style={{ width: '100%', height: imageHeight }} contentFit="cover" transition={180} />
        {!meal.is_available ? (
          <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlayLight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: fontSize.sm }}>غير متاح حاليًا</Text>
          </View>
        ) : null}
        {meal.is_featured ? (
          <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 }}>
            <Text style={{ color: colors.accentForeground, fontFamily: fontFamily.semibold, fontSize: 10 }}>اختيار مميز</Text>
          </View>
        ) : null}
        <Pressable
          onPress={handleHeartPress}
          hitSlop={8}
          style={{ position: 'absolute', top: 9, left: 9, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', ...shadow.sm }}
        >
          <Heart size={17} color={isFav ? colors.destructive : colors.foregroundSecondary} fill={isFav ? colors.destructive : 'transparent'} />
        </Pressable>
      </View>
      <View style={{ padding: spacing.compact, gap: 7 }}>
        <Text numberOfLines={1} style={{ fontFamily: fontFamily.bold, fontSize: size === 'sm' ? fontSize.sm : fontSize.md, color: colors.foreground, textAlign: 'right' }}>
          {meal.name}
        </Text>
        {meal.description ? (
          <Text numberOfLines={1} style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: 'right' }}>
            {meal.description}
          </Text>
        ) : null}
        <MetaRow meal={meal} colors={colors} />
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.primary }}>{formatEGP(meal.price)}</Text>
          <AddButton onPress={handleAdd} active={inCart} colors={colors} animatedStyle={addAnimatedStyle} />
        </View>
      </View>
    </PressableScale>
  );
}

function MetaRow({ meal, colors }: { meal: Meal; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.compact }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
        <Star size={12} color={colors.star} fill={colors.star} />
        <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.foregroundSecondary }}>
          {meal.rating.toFixed(1)}
        </Text>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: 10, color: colors.foregroundTertiary }}>({meal.reviews_count})</Text>
      </View>
      {meal.estimated_preparation_time ? (
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
          <Clock3 size={12} color={colors.mutedForeground} />
          <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground }}>{meal.estimated_preparation_time} د</Text>
        </View>
      ) : null}
    </View>
  );
}

function AddButton({
  onPress,
  active,
  colors,
  animatedStyle,
}: {
  onPress: (event: GestureResponderEvent) => void;
  active: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        hitSlop={6}
        style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: active ? colors.success : colors.primary, alignItems: 'center', justifyContent: 'center' }}
      >
        <Plus size={19} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}
