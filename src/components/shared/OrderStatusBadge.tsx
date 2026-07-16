import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius } from '@/theme/tokens';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types';
import { getStatusColor } from '@/utils';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const { colors } = useTheme();
  const color = getStatusColor(status, colors);

  return (
    <View style={{ backgroundColor: `${color}18`, borderRadius: radius.full, paddingHorizontal: size === 'sm' ? 8 : 12, paddingVertical: size === 'sm' ? 3 : 5, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontFamily: fontFamily.semibold, fontSize: size === 'sm' ? fontSize.xs : fontSize.sm }}>
        {ORDER_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
