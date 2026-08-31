import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FoodCard } from '@/components/shared/FoodCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { fetchFavorites, removeFavorite } from '@/features/favorites/api/favorites.api';
import { useRouter } from 'expo-router';

const QUERY_KEY = 'favorites';

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const favorites = useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: () => fetchFavorites(user!.id),
    enabled: !!user,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await favorites.refetch();
    setRefreshing(false);
  }, [favorites]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader showBack title="المفضلة" showThemeToggle={false} />
        <EmptyState emoji="🔐" title="سجّل دخولك" description="سجّل الدخول لرؤية مفضلتك" />
      </View>
    );
  }

  if (favorites.isError) return <ErrorState onRetry={() => favorites.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="المفضلة" showThemeToggle={false} />

      {favorites.isLoading ? (
        <FlatList
          removeClippedSubviews={false}
          data={Array.from({ length: 4 })}
          keyExtractor={(_, i) => String(i)}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: spacing.sm }}
          renderItem={() => <View style={{ flex: 1 }}><SkeletonCard /></View>}
        />
      ) : favorites.data?.length === 0 ? (
        <EmptyState
          emoji="❤️"
          title="لا توجد أصناف في المفضلة"
          description="اضغط على ❤️ على أي صنف لإضافته للمفضلة"
          action={{ label: 'تصفّح المنيو', onPress: () => router.navigate('/(tabs)/menu') }}
        />
      ) : (
        <FlatList
          removeClippedSubviews={false}
          data={favorites.data}
          keyExtractor={(m) => m.id}
          numColumns={2}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <FoodCard meal={item} />
            </View>
          )}
        />
      )}
    </View>
  );
}
