import { ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StarRating } from '@/components/shared/StarRating';
import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { fetchMyReviews } from '@/features/reviews/api/reviews.api';
import { formatShortDate } from '@/utils';
import { QUERY_KEYS } from '@/constants';

export default function ReviewsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const reviews = useQuery({
    queryKey: [QUERY_KEYS.REVIEWS, 'mine', user?.id],
    queryFn: () => fetchMyReviews(user!.id),
    enabled: !!user,
  });

  if (reviews.isError) return <ErrorState onRetry={() => reviews.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="تقييماتي" showThemeToggle={false} />

      {reviews.isLoading ? (
        <SkeletonList count={4} />
      ) : reviews.data?.length === 0 ? (
        <EmptyState emoji="⭐" title="لا توجد تقييمات" description="قيّم طلباتك المكتملة لتساعد الآخرين في الاختيار" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          {reviews.data?.map((r) => (
            <View
              key={r.id}
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.borderLight,
                padding: spacing.md,
                gap: spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <StarRating rating={r.rating} size={16} />
                <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground }}>
                  {formatShortDate(r.created_at)}
                </Text>
              </View>

              {r.meal && (
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: colors.foreground, textAlign: 'right' }}>
                  {r.meal.name}
                </Text>
              )}

              {r.comment && (
                <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.foreground, textAlign: 'right', lineHeight: 22 }}>
                  {r.comment}
                </Text>
              )}

              <View
                style={{
                  alignSelf: 'flex-end',
                  backgroundColor:
                    r.status === 'approved' ? colors.successSubtle : r.status === 'hidden' ? colors.destructiveSubtle : colors.warningSubtle,
                  borderRadius: radius.full,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamily.semibold,
                    fontSize: fontSize.xs,
                    color: r.status === 'approved' ? colors.success : r.status === 'hidden' ? colors.destructive : colors.warning,
                  }}
                >
                  {r.status === 'approved' ? 'منشور' : r.status === 'hidden' ? 'مخفي' : 'قيد المراجعة'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
