import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { MealVariant, MealVariantExtra, UUID } from '@/types';

export async function fetchVariants(mealId: UUID): Promise<MealVariant[]> {
  const { data: variantsData, error: vError } = await supabase
    .from('meal_variants')
    .select('*')
    .eq('meal_id', mealId)
    .eq('is_available', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  handleSupabaseError(vError);

  if (!variantsData || variantsData.length === 0) {
    return [];
  }

  const variantIds = variantsData.map((v) => v.id);
  const { data: extrasData, error: eError } = await supabase
    .from('meal_variant_extras')
    .select('*')
    .in('variant_id', variantIds)
    .eq('is_available', true)
    .order('display_order', { ascending: true });

  handleSupabaseError(eError);

  const extrasMap = new Map<string, MealVariantExtra[]>();
  (extrasData ?? []).forEach((extra) => {
    const list = extrasMap.get(extra.variant_id) ?? [];
    list.push(extra as MealVariantExtra);
    extrasMap.set(extra.variant_id, list);
  });

  return variantsData.map((v) => ({
    ...(v as MealVariant),
    extras: extrasMap.get(v.id) ?? [],
  }));
}

export async function fetchVariantExtras(variantId: UUID): Promise<MealVariantExtra[]> {
  const { data, error } = await supabase
    .from('meal_variant_extras')
    .select('*')
    .eq('variant_id', variantId)
    .eq('is_available', true)
    .order('display_order', { ascending: true });

  handleSupabaseError(error);
  return (data ?? []) as MealVariantExtra[];
}
