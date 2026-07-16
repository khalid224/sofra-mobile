import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { RatingModal } from './RatingModal';
import type { UUID } from '@/types';

interface Props {
  orderId: UUID;
  cookId: UUID | null;
  onRated: () => void;
}

export function RatingBanner({ orderId, cookId, onRated }: Props) {
  const { colors } = useTheme();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowModal(true);
        }}
        style={{
          backgroundColor: colors.primarySubtle,
          borderRadius: radius.xl,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          marginHorizontal: spacing.md,
          marginVertical: spacing.sm,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: spacing.md,
          borderWidth: 1.5,
          borderColor: colors.primary,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Star size={21} color="#fff" fill="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fontFamily.bold,
              fontSize: fontSize.md,
              color: colors.primary,
              textAlign: 'right',
            }}
          >
            قيّم طلبك 🌟
          </Text>
          <Text
            style={{
              fontFamily: fontFamily.regular,
              fontSize: fontSize.sm,
              color: colors.mutedForeground,
              textAlign: 'right',
            }}
          >
            مشاركتك تساعدنا على التحسين المستمر
          </Text>
        </View>
      </Pressable>

      <RatingModal
        visible={showModal}
        orderId={orderId}
        cookId={cookId}
        onDismiss={() => setShowModal(false)}
        onSubmitted={() => {
          setShowModal(false);
          onRated();
        }}
      />
    </>
  );
}
