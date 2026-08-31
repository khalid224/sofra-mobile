import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Label, Badge } from '@/components/ui/Primitives';
import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { fetchMyComplaints, createComplaint } from '@/features/complaints/api/complaints.api';
import { fetchMyOrders } from '@/features/orders/api/orders.api';
import { formatShortDate } from '@/utils';
import { COMPLAINT_STATUS_LABELS, QUERY_KEYS } from '@/constants';
import type { ComplaintStatus } from '@/types';

const STATUS_TONE: Record<ComplaintStatus, 'destructive' | 'warning' | 'success' | 'muted'> = {
  open: 'destructive',
  investigating: 'warning',
  resolved: 'success',
  closed: 'muted',
};

export default function ComplaintsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ order_id: '', title: '', description: '' });

  const complaints = useQuery({
    queryKey: [QUERY_KEYS.COMPLAINTS, user?.id],
    queryFn: () => fetchMyComplaints(user!.id),
    enabled: !!user,
  });

  const orders = useQuery({
    queryKey: ['complaint-order-options', user?.id],
    queryFn: async () => (await fetchMyOrders(user!.id, 1, 50)).data,
    enabled: !!user && modalOpen,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createComplaint(user!.id, {
        order_id: form.order_id,
        title: form.title,
        description: form.description,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'تم إرسال الشكوى', text2: 'سنراجعها ونرد عليك قريباً' });
      setModalOpen(false);
      setForm({ order_id: '', title: '', description: '' });
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.COMPLAINTS, user?.id] });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: 'حدث خطأ', text2: e.message }),
  });

  const handleSubmit = () => {
    if (!form.order_id) return Toast.show({ type: 'error', text1: 'اختر الطلب المتعلق بالشكوى' });
    if (form.title.trim().length < 3) return Toast.show({ type: 'error', text1: 'العنوان مطلوب' });
    if (form.description.trim().length < 10) return Toast.show({ type: 'error', text1: 'يرجى وصف المشكلة بالتفصيل' });
    createMut.mutate();
  };

  if (complaints.isError) return <ErrorState onRetry={() => complaints.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        showBack
        title="شكاواي"
        showThemeToggle={false}
        rightElement={
          user ? (
            <Pressable
              onPress={() => setModalOpen(true)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={20} color="#fff" />
            </Pressable>
          ) : undefined
        }
      />

      {complaints.isLoading ? (
        <SkeletonList count={3} />
      ) : complaints.data?.length === 0 ? (
        <EmptyState
          emoji="📋"
          title="لا توجد شكاوى"
          description="إذا واجهتك مشكلة في أي طلب، أرسل لنا شكوى وسنحلها فوراً"
          action={user ? { label: 'إرسال شكوى', onPress: () => setModalOpen(true) } : undefined}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          {complaints.data?.map((c) => (
            <View
              key={c.id}
              style={{ backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, gap: spacing.sm }}
            >
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground, flex: 1, textAlign: 'right' }}>
                  {c.title}
                </Text>
                <Badge tone={STATUS_TONE[c.status]}>{COMPLAINT_STATUS_LABELS[c.status]}</Badge>
              </View>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'right' }} numberOfLines={2}>
                {c.description}
              </Text>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: 'right' }}>
                {formatShortDate(c.created_at)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create complaint modal */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground }}>إرسال شكوى جديدة</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <X size={22} color={colors.foreground} />
              </Pressable>
            </View>

            <View>
              <Label required>الطلب المتعلق بالشكوى</Label>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}
              >
                {(orders.data ?? []).map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => setForm((f) => ({ ...f, order_id: o.id }))}
                    style={{
                      backgroundColor: form.order_id === o.id ? colors.primary : colors.muted,
                      borderRadius: radius.full,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: form.order_id === o.id ? '#fff' : colors.foreground }}>
                      #{o.order_number}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View>
              <Label required>عنوان الشكوى</Label>
              <Input value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="مثل: الطلب وصل متأخراً" />
            </View>

            <View>
              <Label required>تفاصيل المشكلة</Label>
              <Textarea
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="اشرح المشكلة بالتفصيل حتى نتمكن من مساعدتك..."
                rows={4}
              />
            </View>

            <Button size="lg" fullWidth loading={createMut.isPending} onPress={handleSubmit}>
              إرسال الشكوى
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}
