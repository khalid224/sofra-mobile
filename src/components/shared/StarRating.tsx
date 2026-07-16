import { View, Pressable } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export function StarRating({ rating, maxRating = 5, size = 16, interactive = false, onRate }: StarRatingProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
      {Array.from({ length: maxRating }).map((_, i) => {
        const filled = i < Math.round(rating);
        const Wrapper = interactive ? Pressable : View;
        return (
          <Wrapper key={i} onPress={interactive ? () => onRate?.(i + 1) : undefined}>
            <Star
              size={size}
              color={filled ? colors.star : colors.border}
              fill={filled ? colors.star : 'transparent'}
            />
          </Wrapper>
        );
      })}
    </View>
  );
}
