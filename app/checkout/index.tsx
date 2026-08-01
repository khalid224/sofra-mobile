import { useState, useMemo, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, Pressable } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { CheckCircle2, AlertTriangle, Calendar, Clock as ClockIcon } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input, Label, Divider } from '@/components/ui/Primitives';
import { useCart, getCartItemKey } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { placeOrder } from '@/features/orders/api/orders.api';
import { formatEGP, validateEgyptianPhone } from '@/utils';
import { supabase } from '@/lib/supabase';
import { QUERY_KEYS } from '@/constants';
import type { PaymentMethod } from '@/types';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'كاش عند الاستلام', icon: '💵' },
  { value: 'card', label: 'بطاقة بنكية', icon: '💳' },
  { value: 'wallet', label: 'محفظة إلكترونية', icon: '📱' },
];

interface CheckoutForm {
  full_name: string;
  phone: string;
  email: string;
  city: string;
  area: string;
  street: string;
  building: string;
  notes: string;
}

export default function CheckoutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { items, subtotal, totalItems, clear } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const isSubmittingRef = useRef(false);
  const [form, setForm] = useState<CheckoutForm>({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    email: '',
    city: '',
    area: '',
    street: '',
    building: '',
    notes: '',
  });
  
  // Date and Time Scheduler State
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [errors, setErrors] = useState<Partial<CheckoutForm> & { delivery_schedule?: string }>({});

  // ── Determine order mix type ────────────────────────────────
  const hasOnlyTodaySpecials = useMemo(() => {
    return items.length > 0 && items.every((i) => i.is_today_special);
  }, [items]);

  // ── Fetch operational hours & delivery fee configured in settings ───────────
  const restaurantStatus = useQuery({
    queryKey: [QUERY_KEYS.RESTAURANT_STATUS],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['restaurant_open_time', 'restaurant_close_time', 'delivery_fee']);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => {
        map[r.key] = String(r.value).replace(/^"|"$/g, '');
      });
      return map;
    },
    staleTime: 60_000,
  });

  const openTime = restaurantStatus.data?.restaurant_open_time ?? '09:00';
  const closeTime = restaurantStatus.data?.restaurant_close_time ?? '22:00';
  const DELIVERY_FEE = Number(restaurantStatus.data?.delivery_fee ?? 25);

  // ── Generate schedule options dynamically ──────────────────
  const dateOptions = useMemo(() => {
    const dates = [];
    const now = new Date();
    // Earliest selectable date is tomorrow
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      dates.push({
        dateString: d.toISOString().split('T')[0], // 'YYYY-MM-DD'
        label: d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' }),
      });
    }
    return dates;
  }, []);

  const timeOptions = useMemo(() => {
    const startHour = parseInt(openTime.split(':')[0], 10);
    const endHour = parseInt(closeTime.split(':')[0], 10);
    const slots = [];
    
    for (let h = startHour; h < endHour; h++) {
      const timeStr = `${String(h).padStart(2, '0')}:00`;
      const ampm = h >= 12 ? 'م' : 'ص';
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      slots.push({
        timeString: timeStr,
        label: `${displayHour}:00 ${ampm}`,
      });
    }
    return slots;
  }, [openTime, closeTime]);

  const validate = (): boolean => {
    const newErrors: Partial<CheckoutForm> & { delivery_schedule?: string } = {};
    if (form.full_name.trim().length < 2) newErrors.full_name = 'الاسم مطلوب';
    if (!validateEgyptianPhone(form.phone)) newErrors.phone = 'رقم موبايل غير صحيح';
    if (!form.city.trim()) newErrors.city = 'المدينة مطلوبة';
    if (!form.area.trim()) newErrors.area = 'المنطقة مطلوبة';
    if (!form.street.trim()) newErrors.street = 'الشارع مطلوب';
    
    if (!hasOnlyTodaySpecials && (!selectedDate || !selectedTime)) {
      newErrors.delivery_schedule = 'يجب اختيار ميعاد الاستلام/التوصيل (بداية من الغد)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => {
      // If Today Special only -> order now today, else combine chosen date + time
      const estimatedDelivery = hasOnlyTodaySpecials
        ? new Date().toISOString()
        : new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

      return placeOrder({
        customer_name: form.full_name,
        customer_phone: form.phone,
        customer_email: form.email || undefined,
        delivery_address: `${form.street}${form.building ? ` - ${form.building}` : ''}`,
        delivery_city: form.city,
        delivery_area: form.area,
        notes: form.notes || undefined,
        payment_method: paymentMethod,
        items: items.map((i) => ({ 
          meal_id: i.meal_id, 
          quantity: i.quantity, 
          customer_notes: i.notes || undefined,
          today_special_id: i.today_special_id || undefined,
          variant_id: i.variant_id || undefined,
          extras: i.extras || undefined,
        })),
        estimated_delivery: estimatedDelivery,
      });
    },
    onSuccess: async (res) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clear();
      router.replace({
        pathname: '/order/success',
        params: { orderId: res.orderId, orderNumber: res.orderNumber },
      });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: 'فشل إرسال الطلب', text2: e.message }),
  });

  const handleSubmit = () => {
    if (isSubmittingRef.current || mutation.isPending) return;
    if (validate()) {
      isSubmittingRef.current = true;
      mutation.mutate(undefined, {
        onError: () => {
          isSubmittingRef.current = false;
        },
      });
    }
  };

  const update = (field: keyof CheckoutForm) => (val: string) => {
    setForm((f) => ({ ...f, [field]: val }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="تأكيد الطلب" showThemeToggle={false} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 160 }}>

          {/* Order Summary */}
          <View style={{ backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight }}>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, textAlign: 'right', marginBottom: spacing.sm }}>
              ملخص الطلب ({totalItems} صنف)
            </Text>
            {items.map((item) => (
              <View key={getCartItemKey(item)} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.foreground }}>
                  {item.name} × {item.quantity}
                  {item.is_today_special && <Text style={{ color: colors.primary, fontSize: 11 }}> (عرض اليوم)</Text>}
                </Text>
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.foreground }}>{formatEGP(item.price * item.quantity)}</Text>
              </View>
            ))}
            <Divider />
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontFamily: fontFamily.regular, color: colors.mutedForeground }}>رسوم التوصيل</Text>
              <Text style={{ fontFamily: fontFamily.semibold, color: colors.foreground }}>{formatEGP(DELIVERY_FEE)}</Text>
            </View>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground }}>الإجمالي</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize.xl, color: colors.primary }}>{formatEGP(subtotal + DELIVERY_FEE)}</Text>
            </View>
          </View>

          {/* Scheduling Section */}
          {hasOnlyTodaySpecials ? (
            <View style={{ backgroundColor: colors.primarySubtle, borderRadius: radius['2xl'], padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '30', flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
              <Calendar size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.primary, textAlign: 'right' }}>
                  توصيل فوري اليوم ⚡
                </Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.primary, textAlign: 'right', marginTop: 2 }}>
                  طلبك يحتوي فقط على عروض اليوم الجاهزة للتقديم فوراً.
                </Text>
              </View>
            </View>
          ) : (
            <SectionCard title="ميعاد الاستلام / التوصيل" colors={colors}>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'right', marginBottom: spacing.xs }}>
                طلبك يحتوي على أكلات تحتاج إلى تجهيز مسبق. أول ميعاد متاح هو غداً.
              </Text>
              
              {/* Date Options list */}
              <Label required>تاريخ التوصيل</Label>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingVertical: 4 }}>
                {dateOptions.map((opt) => {
                  const isSelected = selectedDate === opt.dateString;
                  return (
                    <Pressable
                      key={opt.dateString}
                      onPress={() => {
                        setSelectedDate(opt.dateString);
                        setErrors((e) => ({ ...e, delivery_schedule: undefined }));
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: radius.xl,
                        borderWidth: 1.5,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primarySubtle : colors.card,
                      }}
                    >
                      <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: isSelected ? colors.primary : colors.foreground }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Time Options list */}
              <View style={{ marginTop: spacing.sm }}><Label required>توقيت الاستلام</Label></View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingVertical: 4 }}>
                {timeOptions.map((opt) => {
                  const isSelected = selectedTime === opt.timeString;
                  return (
                    <Pressable
                      key={opt.timeString}
                      onPress={() => {
                        setSelectedTime(opt.timeString);
                        setErrors((e) => ({ ...e, delivery_schedule: undefined }));
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: radius.xl,
                        borderWidth: 1.5,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primarySubtle : colors.card,
                      }}
                    >
                      <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: isSelected ? colors.primary : colors.foreground }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {errors.delivery_schedule && (
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.destructive, textAlign: 'right', marginTop: 4 }}>
                  ⚠️ {errors.delivery_schedule}
                </Text>
              )}
            </SectionCard>
          )}

          {/* Customer Info */}
          <SectionCard title="بيانات المستلم" colors={colors}>
            <Field label="الاسم بالكامل" required>
              <Input value={form.full_name} onChangeText={update('full_name')} placeholder="محمد أحمد" error={errors.full_name} />
            </Field>
            <Field label="رقم الموبايل" required>
              <Input value={form.phone} onChangeText={update('phone')} placeholder="01xxxxxxxxx" keyboardType="phone-pad" error={errors.phone} />
            </Field>
            <Field label="البريد الإلكتروني (اختياري)">
              <Input value={form.email} onChangeText={update('email')} placeholder="example@email.com" keyboardType="email-address" autoCapitalize="none" />
            </Field>
          </SectionCard>

          {/* Delivery Address */}
          <SectionCard title="عنوان التوصيل" colors={colors}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Label required>المدينة</Label>
                <Input value={form.city} onChangeText={update('city')} placeholder="القاهرة" error={errors.city} />
              </View>
              <View style={{ flex: 1 }}>
                <Label required>المنطقة / الحي</Label>
                <Input value={form.area} onChangeText={update('area')} placeholder="المعادي" error={errors.area} />
              </View>
            </View>
            <Field label="الشارع" required>
              <Input value={form.street} onChangeText={update('street')} placeholder="شارع مثال" error={errors.street} />
            </Field>
            <Field label="رقم المبنى / الشقة (اختياري)">
              <Input value={form.building} onChangeText={update('building')} placeholder="مبنى 5 - شقة 3" />
            </Field>
            <Field label="ملاحظات للمندوب (اختياري)">
              <Input value={form.notes} onChangeText={update('notes')} placeholder="مثل: اتصل قبل الوصول" />
            </Field>
          </SectionCard>

          {/* Payment Method */}
          <SectionCard title="طريقة الدفع" colors={colors}>
            {PAYMENT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setPaymentMethod(opt.value)}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5, borderColor: paymentMethod === opt.value ? colors.primary : colors.border, backgroundColor: paymentMethod === opt.value ? colors.primarySubtle : 'transparent', marginBottom: 8 }}
              >
                {paymentMethod === opt.value ? (
                  <CheckCircle2 size={20} color={colors.primary} />
                ) : (
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border }} />
                )}
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: paymentMethod === opt.value ? colors.primary : colors.foreground }}>
                  {opt.icon} {opt.label}
                </Text>
              </Pressable>
            ))}
          </SectionCard>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Submit */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border, padding: spacing.md }}>
        <Button size="xl" fullWidth loading={mutation.isPending} onPress={handleSubmit}>
          إرسال الطلب — {formatEGP(subtotal + DELIVERY_FEE)}
        </Button>
      </View>
    </View>
  );
}

function SectionCard({ title, children, colors }: { title: string; children: React.ReactNode; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight, gap: spacing.sm }}>
      <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground, textAlign: 'right' }}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View>
      <Label required={required}>{label}</Label>
      {children}
    </View>
  );
}
