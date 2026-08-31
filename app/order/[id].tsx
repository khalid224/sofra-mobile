import { ScrollView, Text, View, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Clock } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';
import { SkeletonList } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { fetchOrderById, fetchOrderItems } from '@/features/orders/api/orders.api';
import { fetchSettings } from '@/features/home/api/settings.api';
import { formatEGP, formatDate, getStepIndex } from '@/utils';
import { openWhatsApp } from '@/lib/whatsapp';
import { ORDER_STATUS_LABELS, ORDER_TIMELINE_STEPS } from '@/types';
import { QUERY_KEYS } from '@/constants';
import { RatingBanner } from '@/features/reviews/components/RatingBanner';
import { supabase } from '@/lib/supabase';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

export default function OrderTrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  useRealtimeInvalidate('orders', [QUERY_KEYS.ORDER, id]);
  useRealtimeInvalidate('order_items', ['order-items', id]);

  const order = useQuery({ 
    queryKey: [QUERY_KEYS.ORDER, id], 
    queryFn: () => fetchOrderById(id!),
    enabled: !!id 
  });
  
  const items = useQuery({ 
    queryKey: ['order-items', id], 
    queryFn: () => fetchOrderItems(id!), 
    enabled: !!id 
  });
  
  const settings = useQuery({ 
    queryKey: [QUERY_KEYS.SETTINGS], 
    queryFn: fetchSettings, 
    staleTime: 300_000 
  });

  const rating = useQuery({
    queryKey: ['order-rating', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('order_ratings')
        .select('id')
        .eq('order_id', id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id && order.data?.status === 'delivered',
  });

  if (order.isError) return <ErrorState onRetry={() => order.refetch()} />;

  const currentStep = order.data ? getStepIndex(order.data.status) : -1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="تتبّع الطلب" showThemeToggle={false} />
      {order.isLoading ? (
        <SkeletonList count={4} />
      ) : order.data ? (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 100 }}>

          {/* Status card */}
          <View style={{ backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderLight }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], color: colors.foreground }}>
                  طلب #{order.data.order_number}
                </Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 }}>
                  {formatDate(order.data.created_at)}
                </Text>
              </View>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['2xl'], color: colors.primary }}>
                {formatEGP(order.data.total)}
              </Text>
            </View>
            <OrderStatusBadge status={order.data.status} />
          </View>

          {/* Rating Banner */}
          {order.data.status === 'delivered' && !rating.isLoading && !rating.data && (
            <RatingBanner
              orderId={order.data.id}
              cookId={order.data.cook_id}
              onRated={() => rating.refetch()}
            />
          )}

          {/* Scheduled Delivery Card */}
          {order.data.estimated_delivery && (
            <View style={{ 
              backgroundColor: colors.primarySubtle, 
              borderRadius: radius.xl, 
              padding: spacing.md, 
              borderWidth: 1, 
              borderColor: colors.primary + '30', 
              flexDirection: 'row-reverse', 
              alignItems: 'center', 
              gap: 10 
            }}>
              <Clock size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.primary, textAlign: 'right' }}>
                  ميعاد الاستلام / التوصيل المختار
                </Text>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.primary, textAlign: 'right', marginTop: 2 }}>
                  {formatDate(order.data.estimated_delivery)}
                </Text>
              </View>
            </View>
          )}

          {/* Delivery snapshot */}
          {order.data.delivery_address && (
            <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground, textAlign: 'right', marginBottom: 6 }}>
                عنوان التوصيل
              </Text>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'right' }}>
                {order.data.delivery_area}{'\n'}{order.data.delivery_address}
              </Text>
            </View>
          )}

          {/* Timeline */}
          {order.data.status !== 'cancelled' && (
            <View style={{ backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, textAlign: 'right', marginBottom: spacing.md }}>
                مراحل الطلب
              </Text>
              {ORDER_TIMELINE_STEPS.map((step, i) => {
                const done = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <View key={step} style={{ flexDirection: 'row-reverse', gap: spacing.sm, alignItems: 'flex-start' }}>
                    <View style={{ alignItems: 'center' }}>
                      {done ? (
                        <CheckCircle2 size={22} color={colors.success} />
                      ) : (
                        <Circle size={22} color={isCurrent ? colors.primary : colors.border} />
                      )}
                      {i < ORDER_TIMELINE_STEPS.length - 1 && (
                        <View style={{ width: 2, flex: 1, backgroundColor: done ? colors.success : colors.border, marginVertical: 4, minHeight: 24 }} />
                      )}
                    </View>
                    <Text style={{
                      fontFamily: isCurrent ? fontFamily.bold : fontFamily.regular,
                      fontSize: fontSize.md,
                      color: done ? colors.foreground : colors.mutedForeground,
                      paddingTop: 2,
                      marginBottom: 20,
                    }}>
                      {ORDER_STATUS_LABELS[step]}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {order.data.status === 'cancelled' && (
            <View style={{ backgroundColor: colors.destructiveSubtle, borderRadius: radius.xl, padding: spacing.md }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.destructive, textAlign: 'center' }}>
                تم إلغاء هذا الطلب
              </Text>
            </View>
          )}

          {/* Items */}
          <View style={{ backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight }}>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, textAlign: 'right', marginBottom: spacing.sm }}>
              الأصناف
            </Text>
            {(items.data ?? []).map((item) => (
              <View key={item.id} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderLight }}>
                <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.foreground, flex: 1, textAlign: 'right' }}>
                  {item.meal?.name || item.meal_name} × {item.quantity}
                  {item.today_special_id && <Text style={{ color: colors.primary, fontSize: 11 }}> (عرض اليوم)</Text>}
                </Text>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground }}>
                  {formatEGP(item.total_price)}
                </Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingTop: spacing.sm }}>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground }}>رسوم التوصيل</Text>
              <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.foreground }}>{formatEGP(order.data.delivery_fee)}</Text>
            </View>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground }}>الإجمالي</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize.xl, color: colors.primary }}>{formatEGP(order.data.total)}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={{ gap: spacing.sm }}>
            <Button variant="primary" fullWidth onPress={() => openWhatsApp(settings.data?.whatsapp_number, `السلام عليكم، لدي استفسار بخصوص الطلب رقم #${order.data.order_number}`)}>
              تواصل معنا عبر واتساب 💬
            </Button>
            {settings.data?.business_phone && (
              <Button variant="ghost" fullWidth onPress={() => Linking.openURL(`tel:${settings.data?.business_phone}`)}>
                اتصل بنا
              </Button>
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
