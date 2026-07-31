import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, Package } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';
import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyOrders } from '@/features/orders/api/orders.api';
import { formatEGP, formatTimeAgo } from '@/utils';
import { QUERY_KEYS, ORDER_POLL_INTERVAL } from '@/constants';
import type { Order } from '@/types';

export default function OrdersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const orders = useQuery({
    queryKey: [QUERY_KEYS.MY_ORDERS, user?.id],
    queryFn: () => fetchMyOrders(user!.id),
    enabled: !!user,
    refetchInterval: ORDER_POLL_INTERVAL,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await orders.refetch();
    setRefreshing(false);
  }, [orders]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="طلباتي" showThemeToggle />
        <EmptyState
          emoji="🔐"
          title="سجّل دخولك أولاً"
          description="تحتاج إلى تسجيل الدخول لعرض طلباتك ومتابعتها"
          action={{ label: 'تسجيل الدخول', onPress: () => router.push('/auth') }}
        />
      </View>
    );
  }

  if (orders.isError) return <ErrorState onRetry={() => orders.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="طلباتي" showThemeToggle />

      {orders.isLoading ? (
        <SkeletonList count={5} />
      ) : orders.data?.length === 0 ? (
        <EmptyState
          emoji="📦"
          title="لا توجد طلبات"
          description="لم تقم بأي طلب بعد. تصفّح المنيو واطلب أكلتك المفضلة!"
          action={{ label: 'تصفّح المنيو', onPress: () => router.push('/(tabs)/menu') }}
        />
      ) : (
        <FlatList
          data={orders.data}
          keyExtractor={(o, i) => o.id || `ord-${i}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => <OrderCard order={item} onPress={() => router.push(`/order/${item.id}`)} colors={colors} />}
        />
      )}
    </View>
  );
}

function OrderCard({ order, onPress, colors }: { order: Order; onPress: () => void; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, gap: spacing.sm }}
    >
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
            <Package size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground }}>
              طلب #{order.order_number}
            </Text>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground }}>
              {formatTimeAgo(order.created_at)}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize.lg, color: colors.foreground }}>
            {formatEGP(order.total)}
          </Text>
          <ChevronLeft size={16} color={colors.mutedForeground} />
        </View>
      </View>

      <OrderStatusBadge status={order.status} />
    </Pressable>
  );
}
