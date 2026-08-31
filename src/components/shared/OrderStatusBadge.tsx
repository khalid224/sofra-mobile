import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius } from '@/theme/tokens';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types';
import { getStatusColor } from '@/utils';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  isScheduled?: boolean;
  scheduledFor?: string | null;
  size?: 'sm' | 'md';
}

export function OrderStatusBadge({ status, isScheduled, scheduledFor, size = 'md' }: OrderStatusBadgeProps) {
  const { colors } = useTheme();
  let color = getStatusColor(status, colors);
  let label = ORDER_STATUS_LABELS[status];

  if (isScheduled && status === 'pending_admin') {
    color = '#d97706'; // Amber 600
    let timeText = '';
    if (scheduledFor) {
      try {
        const d = new Date(scheduledFor);
        const todayStr = new Date().toISOString().split('T')[0];
        const dateStr = d.toISOString().split('T')[0];
        const timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        if (dateStr === todayStr) {
          timeText = `اليوم ${timeStr}`;
        } else {
          timeText = `${d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })} ${timeStr}`;
        }
      } catch {}
    }
    label = timeText ? `📅 مجدول للتجهيز (${timeText})` : '📅 مجدول للتجهيز';
  }

  return (
    <View style={{ backgroundColor: `${color}18`, borderRadius: radius.full, paddingHorizontal: size === 'sm' ? 8 : 12, paddingVertical: size === 'sm' ? 3 : 5, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontFamily: fontFamily.semibold, fontSize: size === 'sm' ? fontSize.xs : fontSize.sm }}>
        {label}
      </Text>
    </View>
  );
}
