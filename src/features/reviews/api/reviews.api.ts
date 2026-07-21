import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { Review, UUID } from '@/types';

const REVIEW_FIELDS = `
  id, order_id, customer_id, meal_id, rating, comment, status, is_pinned, created_at, updated_at,
  customer:profiles(id, full_name, avatar_url),
  meal:meals(id, name, image_url)
`;

export interface CreateReviewInput {
  order_id: UUID;
  meal_id: UUID;
  rating: number;
  comment?: string;
}

export async function createReview(customerId: UUID, input: CreateReviewInput): Promise<void> {
  const { error } = await supabase.from('reviews').insert({
    order_id: input.order_id,
    customer_id: customerId,
    meal_id: input.meal_id,
    rating: input.rating,
    comment: input.comment ?? null,
    status: 'pending',
  });
  handleSupabaseError(error);
}

export async function fetchMealReviews(mealId: UUID): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_FIELDS)
    .eq('meal_id', mealId)
    .in('status', ['approved', 'pinned'])
    .order('is_pinned', { ascending: false })
    .order('pin_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(20);
  handleSupabaseError(error);
  return (data ?? []) as unknown as Review[];
}

export async function fetchApprovedReviews(limit = 10): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_FIELDS)
    .in('status', ['approved', 'pinned'])
    .order('is_pinned', { ascending: false })
    .order('pin_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  handleSupabaseError(error);
  return (data ?? []) as unknown as Review[];
}

export async function fetchMyReviews(customerId: UUID): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_FIELDS)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  handleSupabaseError(error);
  return (data ?? []) as unknown as Review[];
}

export async function checkHasReviewed(orderId: UUID): Promise<boolean> {
  const { data } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  return !!data;
}
