import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { Meal, UUID } from '@/types';

const MEAL_FIELDS = `
  id, subcategory_id, name, description, price,
  estimated_preparation_time, image_url, gallery,
  rating, reviews_count, is_available, is_featured,
  is_popular, calories, created_at, updated_at
`;

export async function fetchFavorites(userId: UUID): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select(`meal_id, meals(${MEAL_FIELDS})`)
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
  handleSupabaseError(error);
  return (data ?? []).map((r: { meal_id: string; meals: unknown }) => r.meals as Meal).filter(Boolean);
}

/**
 * A lightweight, shared favorite lookup for meal cards.
 * Every card subscribes to the same React Query key, so a menu renders with
 * one database request instead of one request per card.
 */
export async function fetchFavoriteMealIds(userId: UUID): Promise<UUID[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('meal_id')
    .eq('customer_id', userId);
  handleSupabaseError(error);
  return (data ?? []).map((row) => row.meal_id as UUID);
}

export async function addFavorite(userId: UUID, mealId: UUID): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .upsert({ customer_id: userId, meal_id: mealId }, { onConflict: 'customer_id,meal_id' });
  handleSupabaseError(error);
}

export async function removeFavorite(userId: UUID, mealId: UUID): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('customer_id', userId)
    .eq('meal_id', mealId);
  handleSupabaseError(error);
}

export async function isFavorite(userId: UUID, mealId: UUID): Promise<boolean> {
  const { data } = await supabase
    .from('favorites')
    .select('meal_id')
    .eq('customer_id', userId)
    .eq('meal_id', mealId)
    .maybeSingle();
  return !!data;
}
