import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { AvailableToday, Category, Meal, Subcategory, PaginationParams, PaginatedResponse } from '@/types';
import { DEFAULT_PAGE_SIZE } from '@/constants';

const MEAL_FIELDS = `
  id, subcategory_id, name, description, price,
  estimated_preparation_time, image_url, gallery,
  rating, reviews_count, is_available, is_featured,
  is_popular, calories, created_at, updated_at,
  subcategory:subcategories(
    id, name, image_url,
    category:categories(id, name, image_url)
  )
`;

const CATEGORY_FIELDS = `id, name, description, image_url, sort_order, is_active, created_at, updated_at`;
const SUBCATEGORY_FIELDS = `id, category_id, name, description, image_url, sort_order, is_active, created_at, updated_at`;

const TODAY_FIELDS = `
  id, meal_id, title, description, image_url,
  price, quantity, status, is_active,
  start_time, end_time, expiration_date,
  created_at, updated_at,
  meal:meals(
    id, subcategory_id, name, description, price,
    estimated_preparation_time, image_url, gallery,
    rating, reviews_count, is_available, is_featured,
    is_popular, calories, created_at, updated_at,
    subcategory:subcategories(
      id, name, image_url,
      category:categories(id, name, image_url)
    )
  )
`;

// ─── Categories ──────────────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_FIELDS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  handleSupabaseError(error);
  return (data ?? []) as unknown as Category[];

}

export async function fetchSubcategories(categoryId?: string): Promise<Subcategory[]> {
  let q = supabase.from('subcategories').select(SUBCATEGORY_FIELDS).eq('is_active', true).order('sort_order');
  if (categoryId) q = q.eq('category_id', categoryId);
  const { data, error } = await q;
  handleSupabaseError(error);
  return (data ?? []) as Subcategory[];
}

// ─── Meals list ──────────────────────────────────────────────
export type MealSortOption = 'newest' | 'popular' | 'rating' | 'price_asc' | 'price_desc' | 'most_favorited';

export interface MealFilters extends PaginationParams {
  categoryId?: string;
  subcategoryId?: string;
  search?: string;
  sort?: MealSortOption;
  featured?: boolean;
  popular?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export async function fetchMeals(filters: MealFilters = {}): Promise<PaginatedResponse<Meal>> {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, categoryId, subcategoryId, search, sort = 'newest', featured, popular, minPrice, maxPrice } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from('meals').select(MEAL_FIELDS, { count: 'exact' }).eq('is_available', true);

  if (categoryId) {
    q = q.eq('subcategory.category.id', categoryId);
  }
  if (subcategoryId) q = q.eq('subcategory_id', subcategoryId);
  if (search) q = q.ilike('name', `%${search}%`);
  if (featured) q = q.eq('is_featured', true);
  if (popular) q = q.eq('is_popular', true);
  if (minPrice !== undefined) q = q.gte('price', minPrice);
  if (maxPrice !== undefined) q = q.lte('price', maxPrice);

  switch (sort) {
    case 'popular': q = q.order('reviews_count', { ascending: false }); break;
    case 'rating': q = q.order('rating', { ascending: false }); break;
    case 'price_asc': q = q.order('price', { ascending: true }); break;
    case 'price_desc': q = q.order('price', { ascending: false }); break;
    case 'most_favorited': q = q.order('favorites_count', { ascending: false }); break;
    default: q = q.order('created_at', { ascending: false });
  }

  q = q.range(from, to);
  const { data, error, count } = await q;
  handleSupabaseError(error);

  const total = count ?? 0;
  return {
    data: (data ?? []) as unknown as Meal[],
    count: total,
    page,
    pageSize,
    hasMore: from + pageSize < total,
  };
}

// ─── Meal detail ─────────────────────────────────────────────
export async function fetchMealById(id: string): Promise<Meal> {
  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_FIELDS)
    .eq('id', id)
    .single();
  handleSupabaseError(error);
  return data as unknown as Meal;

}

export async function fetchSimilarMeals(subcategoryId: string, excludeId: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_FIELDS)
    .eq('subcategory_id', subcategoryId)
    .eq('is_available', true)
    .neq('id', excludeId)
    .limit(6);
  handleSupabaseError(error);
  return (data ?? []) as unknown as Meal[];

}

export async function searchMeals(keyword: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_FIELDS)
    .eq('is_available', true)
    .or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
    .limit(20);
  handleSupabaseError(error);
  return (data ?? []) as unknown as Meal[];

}

// ─── Available Today ─────────────────────────────────────────
export async function fetchAvailableToday(): Promise<AvailableToday[]> {
  const { data, error } = await supabase
    .from('available_today')
    .select(TODAY_FIELDS)
    .eq('is_active', true)
    .neq('status', 'expired')
    .order('created_at', { ascending: false });
  handleSupabaseError(error);
  return (data ?? []) as unknown as AvailableToday[];

}

export async function fetchAvailableTodayById(id: string): Promise<AvailableToday> {
  const { data, error } = await supabase
    .from('available_today')
    .select(TODAY_FIELDS)
    .eq('id', id)
    .single();
  handleSupabaseError(error);
  return data as unknown as AvailableToday;

}
