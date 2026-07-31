import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bell, BellOff, Check } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import {
  fetchNotifications,
  markAllRead,
  markOneRead,
} from '@/features/notifications/api/notifications.api';
import { formatTimeAgo } from '@/utils';
import { QUERY_KEYS } from '@/constants';
import type { AppNotification, NotificationType } from '@/types';

const TYPE_EMOJI: Record<NotificationType, string> = {
  order_received: '📦',
  order_accepted: '✅',
  order_preparing: '👨‍🍳',
  order_ready: '🎉',
  order_out_for_delivery: '🚗',
  order_delivered: '🏠',
  order_cancelled: '❌',
  complaint_update: '📋',
  chat_reply: '💬',
  promotion: '🎁',
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const notifications = useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATIONS, user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const markAllMut = useMutation({
    mutationFn: () => markAllRead(user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS, user?.id] }),
  });

  const markOneMut = useMutation({
    mutationFn: (id: string) => markOneRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS, user?.id] }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await notifications.refetch();
    setRefreshing(false);
  }, [notifications]);

  const handlePressNotification = (item: AppNotification) => {
    if (!item.is_read) {
      markOneMut.mutate(item.id);
    }
    if (item.data?.order_id) {
      router.push(`/order/${item.data.order_id}` as never);
    } else if (item.data?.screen) {
      router.push(item.data.screen as never);
    }
  };

  const unreadCount = (notifications.data ?? []).filter((n) => !n.is_read).length;

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="الإشعارات" showBack showThemeToggle={false} />
        <EmptyState emoji="🔐" title="سجّل دخولك أولاً" description="تحتاج تسجيل الدخول لعرض إشعاراتك" />
      </View>
    );
  }

  if (notifications.isError) return <ErrorState onRetry={() => notifications.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={`الإشعارات${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        showBack
        showThemeToggle={false}
        rightElement={
          unreadCount > 0 ? (
            <Pressable onPress={() => markAllMut.mutate()} hitSlop={8}>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.primary }}>
                قراءة الكل
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {notifications.isLoading ? (
        <SkeletonList count={5} />
      ) : notifications.data?.length === 0 ? (
        <EmptyState
          emoji="🔔"
          title="لا توجد إشعارات"
          description="ستظهر هنا إشعارات طلباتك وعروضنا الخاصة"
        />
      ) : (
        <FlatList
          data={notifications.data}
          keyExtractor={(item, index) => item.id || `notif-${index}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onPress={() => handlePressNotification(item)}
              colors={colors}
            />
          )}
        />
      )}
    </View>
  );
}

function NotificationCard({
  notification: n,
  onPress,
  colors,
}: {
  notification: AppNotification;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: n.is_read ? colors.card : colors.primarySubtle,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: n.is_read ? colors.borderLight : colors.primary + '33',
        padding: spacing.md,
        flexDirection: 'row-reverse',
        gap: spacing.sm,
        alignItems: 'flex-start',
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: n.is_read ? colors.muted : colors.primarySubtle,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Text style={{ fontSize: 20 }}>
          {TYPE_EMOJI[n.type as NotificationType] ?? '🔔'}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: n.is_read ? fontFamily.medium : fontFamily.bold, fontSize: fontSize.md, color: colors.foreground, flex: 1, textAlign: 'right' }}>
            {n.title}
          </Text>
          {!n.is_read && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: spacing.xs }} />
          )}
        </View>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.foreground, textAlign: 'right', lineHeight: 20 }}>
          {n.body}
        </Text>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: 'right' }}>
          {formatTimeAgo(n.created_at)}
        </Text>
      </View>
    </Pressable>
  );
}
