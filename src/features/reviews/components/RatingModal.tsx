import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Star, X, ChefHat } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { UUID } from '@/types';

interface RatingCategory {
  key: 'food_rating' | 'delivery_rating' | 'overall_rating';
  label: string;
  emoji: string;
}

const RATING_CATEGORIES: RatingCategory[] = [
  { key: 'food_rating',     label: 'جودة الطعام',     emoji: '🍽️' },
  { key: 'delivery_rating', label: 'التوصيل',         emoji: '🛵' },
  { key: 'overall_rating',  label: 'التجربة العامة',  emoji: '⭐' },
];

interface Props {
  visible: boolean;
  orderId: UUID;
  cookId: UUID | null;
  onDismiss: () => void;
  onSubmitted: () => void;
}

export function RatingModal({ visible, orderId, cookId, onDismiss, onSubmitted }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [ratings, setRatings] = useState<Record<string, number>>({
    food_rating: 0,
    delivery_rating: 0,
    overall_rating: 0,
  });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPreferredPrompt, setShowPreferredPrompt] = useState(false);

  const setRating = (key: string, value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const isComplete = RATING_CATEGORIES.every((c) => ratings[c.key] > 0);

  const handleSubmit = async () => {
    if (!isComplete || !user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('order_ratings').insert({
        order_id:       orderId,
        customer_id:    user.id,
        cook_id:        cookId,
        food_rating:    ratings.food_rating,
        delivery_rating: ratings.delivery_rating,
        overall_rating:  ratings.overall_rating,
        comment:        comment.trim() || null,
      });
      if (error) throw error;

      // If overall >= 4 and a cook is assigned, ask to set preferred cook
      if (ratings.overall_rating >= 4 && cookId) {
        setShowPreferredPrompt(true);
      } else {
        Toast.show({ type: 'success', text1: 'شكراً على تقييمك! 🌟', position: 'top' });
        onSubmitted();
      }
    } catch {
      Toast.show({ type: 'error', text1: 'حدث خطأ', text2: 'لم يتم حفظ التقييم', position: 'top' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPreferredCook = async (set: boolean) => {
    if (set && user && cookId) {
      await supabase
        .from('profiles')
        .update({ preferred_cook_id: cookId })
        .eq('id', user.id);
    }
    Toast.show({ type: 'success', text1: 'شكراً على تقييمك! 🌟', position: 'top' });
    setShowPreferredPrompt(false);
    onSubmitted();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: spacing.xl,
            maxHeight: '88%',
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: colors.border,
              alignSelf: 'center', marginBottom: spacing.md,
            }}
          />

          {showPreferredPrompt ? (
            // ── Preferred cook prompt ──────────────────────────────
            <View style={{ alignItems: 'center', gap: spacing.lg, paddingBottom: spacing.xl }}>
              <ChefHat size={52} color={colors.primary} />
              <Text
                style={{
                  fontFamily: fontFamily.bold, fontSize: fontSize.xl,
                  color: colors.foreground, textAlign: 'center',
                }}
              >
                تريد نفس الطاهي في طلباتك القادمة؟
              </Text>
              <Text
                style={{
                  fontFamily: fontFamily.regular, fontSize: fontSize.md,
                  color: colors.mutedForeground, textAlign: 'center',
                }}
              >
                يمكننا تفضيل نفس الطاهي الموهوب في طلباتك المستقبلية.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.md, width: '100%' }}>
                <Pressable
                  onPress={() => handleSetPreferredCook(true)}
                  style={{
                    flex: 1, backgroundColor: colors.primary,
                    borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.primaryForeground, fontFamily: fontFamily.bold, fontSize: fontSize.md }}>
                    نعم، فضّله
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSetPreferredCook(false)}
                  style={{
                    flex: 1, backgroundColor: colors.muted,
                    borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.bold, fontSize: fontSize.md }}>
                    لا شكراً
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row-reverse',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.lg,
                }}
              >
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize.xl, color: colors.foreground }}>
                  قيّم طلبك
                </Text>
                <Pressable onPress={onDismiss} hitSlop={10}>
                  <X size={22} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Star rating rows */}
              {RATING_CATEGORIES.map((cat) => (
                <View key={cat.key} style={{ marginBottom: spacing.lg }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.semibold, fontSize: fontSize.md,
                      color: colors.foreground, textAlign: 'right', marginBottom: spacing.sm,
                    }}
                  >
                    {cat.emoji} {cat.label}
                  </Text>
                  <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <Pressable key={v} onPress={() => setRating(cat.key, v)} hitSlop={4}>
                        <Star
                          size={38}
                          color={v <= ratings[cat.key] ? '#FBBF24' : colors.border}
                          fill={v <= ratings[cat.key] ? '#FBBF24' : 'transparent'}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}

              {/* Comment */}
              <Text
                style={{
                  fontFamily: fontFamily.semibold, fontSize: fontSize.md,
                  color: colors.foreground, textAlign: 'right', marginBottom: spacing.sm,
                }}
              >
                💬 تعليق (اختياري)
              </Text>
              <TextInput
                multiline
                numberOfLines={3}
                value={comment}
                onChangeText={setComment}
                placeholder="شاركنا تجربتك..."
                placeholderTextColor={colors.mutedForeground}
                textAlign="right"
                textAlignVertical="top"
                style={{
                  backgroundColor: colors.input,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  minHeight: 80,
                  fontFamily: fontFamily.regular,
                  fontSize: fontSize.md,
                  color: colors.foreground,
                  marginBottom: spacing.xl,
                }}
              />

              {/* Submit button */}
              <Pressable
                onPress={handleSubmit}
                disabled={!isComplete || loading}
                style={{
                  backgroundColor: isComplete ? colors.primary : colors.muted,
                  borderRadius: radius.lg,
                  paddingVertical: 16,
                  alignItems: 'center',
                  marginBottom: spacing.md,
                }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text
                    style={{
                      color: isComplete ? colors.primaryForeground : colors.mutedForeground,
                      fontFamily: fontFamily.bold,
                      fontSize: fontSize.md,
                    }}
                  >
                    إرسال التقييم
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
