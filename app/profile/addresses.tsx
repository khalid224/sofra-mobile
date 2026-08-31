import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Primitives';
import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import {
  fetchAddresses,
  createAddress,
  deleteAddress,
  setDefaultAddress,
  type CreateAddressInput,
} from '@/features/profile/api/profile.api';

const QUERY_KEY = 'addresses';

export default function AddressesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateAddressInput>({ title: '', area: '', street: '', building: '', floor: '', apartment: '', landmark: '' });

  const addresses = useQuery({ queryKey: [QUERY_KEY, user?.id], queryFn: () => fetchAddresses(user!.id), enabled: !!user });

  const createMut = useMutation({
    mutationFn: () => createAddress(user!.id, form),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'تمت إضافة العنوان' });
      setModalOpen(false);
      setForm({ title: '', area: '', street: '', building: '', floor: '', apartment: '', landmark: '' });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, user?.id] });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: 'حدث خطأ', text2: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, user?.id] }),
  });

  const defaultMut = useMutation({
    mutationFn: (id: string) => setDefaultAddress(user!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, user?.id] }),
  });

  const handleCreate = () => {
    if (!form.title.trim() || form.area.trim().length < 2 || form.street.trim().length < 5) {
      return Toast.show({ type: 'error', text1: 'يرجى تعبئة الحقول المطلوبة' });
    }
    createMut.mutate();
  };

  if (addresses.isError) return <ErrorState onRetry={() => addresses.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        showBack
        title="عناويني"
        showThemeToggle={false}
        rightElement={
          <Pressable onPress={() => setModalOpen(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color="#fff" />
          </Pressable>
        }
      />

      {addresses.isLoading ? (
        <SkeletonList count={3} />
      ) : addresses.data?.length === 0 ? (
        <EmptyState
          emoji="📍"
          title="لا توجد عناوين"
          description="أضف عنوانك لتسريع عملية الطلب"
          action={{ label: 'إضافة عنوان', onPress: () => setModalOpen(true) }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          {addresses.data?.map((addr) => (
            <View key={addr.id} style={{ backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: addr.is_default ? 2 : 1, borderColor: addr.is_default ? colors.primary : colors.borderLight, padding: spacing.md, gap: spacing.sm }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.foreground }}>{addr.title}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {!addr.is_default && (
                    <Pressable onPress={() => defaultMut.mutate(addr.id)} hitSlop={8}>
                      <Star size={18} color={colors.warning} />
                    </Pressable>
                  )}
                  <Pressable onPress={() => deleteMut.mutate(addr.id)} hitSlop={8}>
                    <Trash2 size={18} color={colors.destructive} />
                  </Pressable>
                </View>
              </View>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'right' }}>
                {addr.area} - {addr.street}
                {addr.building ? ` - مبنى ${addr.building}` : ''}
              </Text>
              {addr.is_default && (
                <View style={{ alignSelf: 'flex-end', backgroundColor: colors.primarySubtle, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.xs, color: colors.primary }}>الافتراضي</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: spacing.lg, gap: spacing.md, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground }}>إضافة عنوان جديد</Text>
              <Pressable onPress={() => setModalOpen(false)}><X size={22} color={colors.foreground} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {([
                { key: 'title', label: 'اسم العنوان', placeholder: 'مثل: المنزل، العمل', required: true },
                { key: 'area', label: 'الحي / المنطقة', placeholder: 'المعادي', required: true },
                { key: 'street', label: 'الشارع', placeholder: 'شارع مثال', required: true },
                { key: 'building', label: 'رقم المبنى', placeholder: '5', required: false },
                { key: 'floor', label: 'الطابق', placeholder: '3', required: false },
                { key: 'apartment', label: 'رقم الشقة', placeholder: '12', required: false },
                { key: 'landmark', label: 'علامة مميزة', placeholder: 'بجوار مسجد...', required: false },
              ] as { key: keyof CreateAddressInput; label: string; placeholder: string; required: boolean }[]).map((f) => (
                <View key={f.key}>
                  <Label required={f.required}>{f.label}</Label>
                  <Input
                    value={String(form[f.key] ?? '')}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                    placeholder={f.placeholder}
                  />
                </View>
              ))}
            </ScrollView>
            <Button size="lg" fullWidth loading={createMut.isPending} onPress={handleCreate}>
              حفظ العنوان
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}
