import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Minus, Plus, ReceiptText, ShoppingBag, Trash2 } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Divider, Input } from '@/components/ui/Primitives';
import { EmptyState } from '@/components/ui/States';
import { PressableScale } from '@/components/ui/PressableScale';
import { useCart, getCartItemKey } from '@/contexts/CartContext';
import { supabase } from '@/lib/supabase';
import { QUERY_KEYS } from '@/constants';
import { formatEGP } from '@/utils';
import type { CartItem } from '@/types';

export default function CartScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { items, totalItems, subtotal, removeItem, setQuantity, setNotes, clear } = useCart();

  const deliveryFeeQuery = useQuery({
    queryKey: [QUERY_KEYS.RESTAURANT_STATUS, 'delivery_fee'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'delivery_fee').maybeSingle();
      return Number(String(data?.value ?? 25).replace(/^"|"$/g, '')) || 25;
    },
    staleTime: 60_000,
  });
  const deliveryFee = deliveryFeeQuery.data ?? 25;
  const discount = 0;
  const total = subtotal + deliveryFee - discount;

  if (!items.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="سلة المشتريات" showBack showThemeToggle={false} />
        <EmptyState emoji="🛍️" title="سلتك لسه فاضية" description="اختار اللي نفسك فيه وهنوصله لحد بابك" action={{ label: 'تصفّح القائمة', onPress: () => router.navigate('/(tabs)/menu') }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={`السلة · ${totalItems} ${totalItems === 1 ? 'صنف' : 'أصناف'}`}
        showBack
        showThemeToggle={false}
        rightElement={(
          <Pressable onPress={clear} hitSlop={8} style={{ paddingVertical: 6 }}>
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.xs, color: colors.destructive }}>إفراغ السلة</Text>
          </Pressable>
        )}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          removeClippedSubviews={false}
          data={items}
          keyExtractor={getCartItemKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 286 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.compact }} />}
          ListHeaderComponent={(
            <View style={{ marginBottom: spacing.md, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag size={19} color={colors.primary} />
              </View>
              <View>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, textAlign: 'right' }}>راجع طلبك</Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: 'right' }}>تقدر تعدّل الكمية أو تضيف ملاحظة</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => (
            <CartItemCard item={item} setQuantity={setQuantity} setNotes={setNotes} removeItem={removeItem} />
          )}
        />
      </KeyboardAvoidingView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], padding: spacing.md, paddingBottom: spacing.lg, ...shadow.lg }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.compact }}>
          <ReceiptText size={18} color={colors.primary} />
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground }}>ملخص الحساب</Text>
        </View>
        <SummaryRow label="المجموع الفرعي" value={formatEGP(subtotal)} />
        <SummaryRow label="رسوم التوصيل" value={formatEGP(deliveryFee)} />
        {discount > 0 ? <SummaryRow label="الخصم" value={`- ${formatEGP(discount)}`} success /> : null}
        <Divider />
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.compact }}>
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground }}>الإجمالي</Text>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['2xl'], color: colors.primary }}>{formatEGP(total)}</Text>
        </View>
        <Button size="lg" fullWidth onPress={() => router.push('/checkout')}>متابعة تأكيد الطلب</Button>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, success = false }: { label: string; value: string; success?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 7 }}>
      <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground }}>{label}</Text>
      <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: success ? colors.success : colors.foreground }}>{value}</Text>
    </View>
  );
}

function CartItemCard({ item, setQuantity, setNotes, removeItem }: {
  item: CartItem;
  setQuantity: (id: string, quantity: number) => void;
  setNotes: (id: string, notes: string) => void;
  removeItem: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [notesExpanded, setNotesExpanded] = useState(!!item.notes);
  const itemKey = getCartItemKey(item);

  const updateQuantity = (quantity: number) => {
    Haptics.selectionAsync().catch(() => undefined);
    if (quantity < 1) removeItem(itemKey);
    else setQuantity(itemKey, quantity);
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.compact, ...shadow.card }}>
      <View style={{ flexDirection: 'row-reverse', gap: spacing.compact }}>
        <Image source={{ uri: item.image_url ?? '' }} style={{ width: 88, height: 88, borderRadius: radius.md, backgroundColor: colors.muted }} contentFit="cover" transition={160} />
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, lineHeight: 22, color: colors.foreground, textAlign: 'right' }}>{item.name}</Text>
              {item.variant_name ? <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: 'right' }}>{item.variant_name}</Text> : null}
            </View>
            <Pressable onPress={() => removeItem(itemKey)} hitSlop={8} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.destructiveSubtle, alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={15} color={colors.destructive} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.primary }}>{formatEGP(item.price * item.quantity)}</Text>
            <View style={{ height: 34, borderRadius: 12, backgroundColor: colors.muted, flexDirection: 'row-reverse', alignItems: 'center', overflow: 'hidden' }}>
              <PressableScale onPress={() => updateQuantity(item.quantity + 1)} style={{ width: 34, height: 34 }} contentStyle={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
                <Plus size={15} color="#FFFFFF" />
              </PressableScale>
              <Text style={{ minWidth: 34, textAlign: 'center', color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.sm }}>{item.quantity}</Text>
              <Pressable onPress={() => updateQuantity(item.quantity - 1)} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                <Minus size={15} color={colors.foregroundSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <Pressable onPress={() => setNotesExpanded((current) => !current)} style={{ alignSelf: 'flex-end', paddingTop: spacing.sm }}>
        <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.xs, color: colors.primary }}>{item.notes ? 'تعديل الملاحظة' : '+ إضافة ملاحظة للمطعم'}</Text>
      </Pressable>
      {notesExpanded ? (
        <View style={{ marginTop: spacing.sm }}>
          <Input value={item.notes} onChangeText={(value) => setNotes(itemKey, value)} placeholder="مثال: بدون بصل، ملح خفيف..." style={{ fontSize: fontSize.sm }} />
        </View>
      ) : null}
    </View>
  );
}
