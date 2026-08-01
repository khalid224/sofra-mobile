import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Primitives';
import { EmptyState } from '@/components/ui/States';
import { Divider } from '@/components/ui/Primitives';
import { useCart, getCartItemKey } from '@/contexts/CartContext';
import { formatEGP } from '@/utils';
import type { CartItem } from '@/types';

export default function CartScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { items, totalItems, subtotal, removeItem, setQuantity, setNotes, clear } = useCart();

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="سلة المشتريات" showBack showThemeToggle />

        <EmptyState
          emoji="🛒"
          title="سلتك فاضية"
          description="أضف أكلاتك المفضلة من المنيو وهنوصلهالك بسرعة"
          action={{ label: 'تصفّح المنيو', onPress: () => router.push('/(tabs)/menu') }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={`سلة المشتريات (${totalItems})`}
        showBack
        showThemeToggle

        rightElement={
          <Pressable onPress={clear} hitSlop={8}>
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.destructive }}>مسح الكل</Text>
          </Pressable>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.variant_id ? `${item.meal_id}-${item.variant_id}` : item.meal_id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 200 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => <CartItemCard item={item} colors={colors} setQuantity={setQuantity} setNotes={setNotes} removeItem={removeItem} />}
        />
      </KeyboardAvoidingView>

      {/* Sticky bottom summary */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.lg }}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.mutedForeground }}>المجموع الفرعي</Text>
          <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: colors.foreground }}>{formatEGP(subtotal)}</Text>
        </View>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: 'right', marginBottom: spacing.sm }}>
          سيتم إضافة رسوم التوصيل عند الطلب
        </Text>
        <Button size="lg" fullWidth onPress={() => router.push('/checkout')}>
          متابعة الطلب — {formatEGP(subtotal)}
        </Button>
      </View>
    </View>
  );
}

function CartItemCard({ item, colors, setQuantity, setNotes, removeItem }: {
  item: CartItem;
  colors: ReturnType<typeof useTheme>['colors'];
  setQuantity: (id: string, q: number) => void;
  setNotes: (id: string, n: string) => void;
  removeItem: (id: string) => void;
}) {
  const [notesExpanded, setNotesExpanded] = useState(false);

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card }}>
      <View style={{ flexDirection: 'row-reverse', gap: spacing.sm, padding: spacing.sm }}>
        <Image source={{ uri: item.image_url ?? '' }} style={{ width: 80, height: 80, borderRadius: radius.lg }} contentFit="cover" />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <Text numberOfLines={2} style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground, flex: 1, textAlign: 'right' }}>
              {item.name}
            </Text>
            <Pressable onPress={() => removeItem(getCartItemKey(item))} hitSlop={8} style={{ paddingLeft: 8 }}>
              <Trash2 size={18} color={colors.destructive} />
            </Pressable>
          </View>

          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize.lg, color: colors.primary, textAlign: 'right' }}>
            {formatEGP(item.price * item.quantity)}
          </Text>

          {/* Quantity stepper */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              onPress={() => item.quantity > 1 ? setQuantity(getCartItemKey(item), item.quantity - 1) : removeItem(getCartItemKey(item))}
              style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Minus size={14} color={colors.foreground} />
            </Pressable>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, minWidth: 24, textAlign: 'center' }}>
              {item.quantity}
            </Text>
            <Pressable
              onPress={() => setQuantity(getCartItemKey(item), item.quantity + 1)}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={14} color="#fff" />
            </Pressable>

            <Pressable onPress={() => setNotesExpanded((p) => !p)} style={{ marginRight: 'auto' }}>
              <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.primary }}>
                {item.notes ? 'تعديل الملاحظة' : '+ ملاحظة'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {notesExpanded && (
        <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
          <Divider />
          <View style={{ marginTop: spacing.sm }}>
            <Input
              value={item.notes}
              onChangeText={(v) => setNotes(getCartItemKey(item), v)}
              placeholder="ملاحظات للطاهي (مثل: بدون بصل، ملح خفيف...)"
              style={{ fontSize: fontSize.sm }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
