import { useEffect, useState, useMemo, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, Pressable } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
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
const PAYMENT_OPTIONS: { value: 'cash'; label: string; icon: string }[] = [
  { value: 'cash', label: 'كاش عند الاستلام', icon: '💵' },
];

interface CheckoutForm {
  full_name: string;
  phone: string;
  email: string;
  area: string;
  street: string;
  building: string;
  notes: string;
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CheckoutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile, user } = useAuth();
  const { items, subtotal, totalItems, clear } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<'cash'>('cash');
  const isSubmittingRef = useRef(false);
  const [form, setForm] = useState<CheckoutForm>({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    email: '',
    area: '',
    street: '',
    building: '',
    notes: '',
  });

  useEffect(() => {
    if (!profile) return;
    setForm((current) => ({
      ...current,
      full_name: current.full_name || profile.full_name || '',
      phone: current.phone || profile.phone || '',
      email: current.email || profile.email || '',
    }));
  }, [profile]);
  
  // Date and Time Scheduler State
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [errors, setErrors] = useState<Partial<CheckoutForm> & { delivery_schedule?: string }>({});

  // ── Fetch operational hours & delivery fee configured in settings ───────────
  const restaurantStatus = useQuery({
    queryKey: [QUERY_KEYS.RESTAURANT_STATUS],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'delivery_window_start',
          'delivery_window_end',
          'prep_duration_minutes',
          'slot_interval_minutes',
          'delivery_fee',
        ]);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => {
        map[r.key] = String(r.value).replace(/^"|"$/g, '');
      });
      return map;
    },
    staleTime: 60_000,
  });

  const windowStart = restaurantStatus.data?.delivery_window_start ?? '12:00';
  const windowEnd = restaurantStatus.data?.delivery_window_end ?? '00:00';
  const prepDuration = Number(restaurantStatus.data?.prep_duration_minutes ?? 45);
  const slotInterval = Number(restaurantStatus.data?.slot_interval_minutes ?? 30);
  const DELIVERY_FEE = Number(restaurantStatus.data?.delivery_fee ?? 25);

  // ── Generate schedule options dynamically ──────────────────
  const dateOptions = useMemo(() => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dateString = toLocalDateString(d);
      let label = d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' });
      if (i === 0) label = `اليوم (${d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })})`;
      if (i === 1) label = `غداً (${d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })})`;

      dates.push({ dateString, label, isToday: i === 0 });
    }
    return dates;
  }, []);

  // Set default selected date if empty
  const activeDate = selectedDate || dateOptions[0]?.dateString || '';

  const timeOptions = useMemo(() => {
    if (!activeDate) return [];

    const now = new Date();
    const isToday = activeDate === toLocalDateString(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = windowStart.split(':').map((n) => parseInt(n, 10) || 0);
    const [endH, endM] = windowEnd.split(':').map((n) => parseInt(n, 10) || 0);

    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60; // Midnight rollover (e.g., 12 PM to 12 AM = 1440 min)
    }

    // Latest time a slot can start so slot + prepDuration <= endMinutes
    const maxSlotStart = endMinutes - prepDuration;

    let minSlotStart = startMinutes;
    if (isToday) {
      const earliestAvailable = currentMinutes + prepDuration;
      minSlotStart = Math.max(startMinutes, earliestAvailable);
      // Round up to next slotInterval
      const remainder = minSlotStart % slotInterval;
      if (remainder !== 0) {
        minSlotStart += slotInterval - remainder;
      }
    }

    const slots = [];
    for (let m = minSlotStart; m <= maxSlotStart; m += slotInterval) {
      const actualMinutes = m % (24 * 60);
      const h = Math.floor(actualMinutes / 60);
      const min = actualMinutes % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const ampm = h >= 12 && h < 24 ? 'م' : 'ص';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const label = `${displayH}:${String(min).padStart(2, '0')} ${ampm}`;

      slots.push({ timeString: timeStr, label });
    }

    return slots;
  }, [activeDate, windowStart, windowEnd, prepDuration, slotInterval]);

  // Auto-select date & time if current selection is invalid
  const activeTime = selectedTime || timeOptions[0]?.timeString || '';

  const validate = (): boolean => {
    const newErrors: Partial<CheckoutForm> & { delivery_schedule?: string } = {};
    if (form.full_name.trim().length < 2) newErrors.full_name = 'الاسم مطلوب';
    if (!validateEgyptianPhone(form.phone)) newErrors.phone = 'رقم موبايل غير صحيح';
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) newErrors.email = 'البريد الإلكتروني غير صحيح';
    if (form.area.trim().length < 2) newErrors.area = 'اكتب اسم المنطقة بشكل صحيح';
    if (form.street.trim().length < 5) newErrors.street = 'اكتب اسم الشارع بالتفصيل (5 أحرف على الأقل)';
    
    if (!activeDate || !activeTime) {
      newErrors.delivery_schedule = 'يجب اختيار ميعاد الاستلام/التوصيل المتاح';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => {
      const scheduledIso = new Date(`${activeDate}T${activeTime}:00`).toISOString();
      const now = new Date();
      const isScheduled = new Date(scheduledIso).getTime() - now.getTime() > 10 * 60 * 1000;

      return placeOrder({
        customer_name: form.full_name.trim(),
        customer_phone: form.phone.trim(),
        customer_email: form.email.trim() || undefined,
        delivery_address: [form.street.trim(), form.building.trim() ? `مبنى/شقة: ${form.building.trim()}` : ''].filter(Boolean).join(' - '),
        // The legacy DB snapshot still has a city field. Use the area internally
        // until that column is retired; the customer no longer has to enter it.
        delivery_city: form.area.trim(),
        delivery_area: form.area.trim(),
        notes: form.notes.trim() || undefined,
        payment_method: paymentMethod,
        items: items.map((i) => ({ 
          meal_id: i.meal_id, 
          quantity: i.quantity, 
          customer_notes: i.notes || undefined,
          today_special_id: i.today_special_id || undefined,
          variant_id: i.variant_id || undefined,
          extras: i.extras || undefined,
        })),
        estimated_delivery: scheduledIso,
        is_scheduled: isScheduled,
        scheduled_for: scheduledIso,
      });
    },
    onSuccess: async (res) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      clear();
      requestAnimationFrame(() => {
        router.replace({
          pathname: '/order/success',
          params: { orderId: res.orderId, orderNumber: res.orderNumber },
        });
      });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: 'فشل إرسال الطلب', text2: e.message }),
    onSettled: () => { isSubmittingRef.current = false; },
  });

  const handleSubmit = () => {
    if (isSubmittingRef.current || mutation.isPending) return;
    if (!user) {
      Toast.show({ type: 'info', text1: 'سجّل الدخول أولاً', text2: 'حسابك مطلوب لحماية الطلب وتتبع حالته' });
      router.push('/auth');
      return;
    }
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

          {/* 24/7 Delivery Scheduler Section */}
          <SectionCard title="ميعاد الاستلام / التوصيل 🕒" colors={colors}>
            <View style={{ backgroundColor: colors.primarySubtle, borderRadius: radius.xl, padding: 12, borderWidth: 1, borderColor: colors.primary + '30', gap: 4 }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.primary, textAlign: 'right' }}>
                سيبدأ تجهيز طلبك الساعة {timeOptions.find((t) => t.timeString === activeTime)?.label ?? activeTime}
              </Text>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: 'right' }}>
                مواعيد تشغيل المطبخ اليومية: من {windowStart} إلى {windowEnd} · مدة التجهيز المتوقعة: {prepDuration} دقيقة.
              </Text>
            </View>

            {/* Date Options list */}
            <Label required>تاريخ التوصيل</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingVertical: 4 }}>
              {dateOptions.map((opt) => {
                const isSelected = activeDate === opt.dateString;
                return (
                  <Pressable
                    key={opt.dateString}
                    onPress={() => {
                      setSelectedDate(opt.dateString);
                      setSelectedTime(''); // reset time selection for new date
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
            <View style={{ marginTop: spacing.sm }}><Label required>توقيت الاستلام المتاح</Label></View>
            {timeOptions.length === 0 ? (
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.xs, color: colors.destructive, textAlign: 'right' }}>
                عذراً، لا تتوفر مواعيد متاحة في هذا اليوم. يرجى اختيار تاريخ آخر.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingVertical: 4 }}>
                {timeOptions.map((opt) => {
                  const isSelected = activeTime === opt.timeString;
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
            )}

            {errors.delivery_schedule && (
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.destructive, textAlign: 'right', marginTop: 4 }}>
                ⚠️ {errors.delivery_schedule}
              </Text>
            )}
          </SectionCard>

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
            <Field label="المنطقة / الحي" required>
              <Input value={form.area} onChangeText={update('area')} placeholder="المعادي" error={errors.area} />
            </Field>
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
