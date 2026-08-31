import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { Order, OrderItem, OrderTimeline, PaginatedResponse, UUID } from '@/types';

const ORDER_FIELDS = `
  id, customer_id, address_id, cook_id, order_number,
  subtotal, delivery_fee, discount, tax, total,
  status, payment_method, payment_status, notes,
  delivery_name, delivery_phone, delivery_email,
  delivery_address, delivery_city, delivery_area,
  estimated_delivery, is_scheduled, scheduled_for, created_at, updated_at
`;

const ORDER_ITEM_FIELDS = `
  id, order_id, meal_id, quantity, unit_price, total_price,
  customer_notes, today_special_id, meal_name, meal_image, created_at, updated_at,
  meal:meals(id, name, image_url, price)
`;


export interface PlaceOrderInput {
  idempotency_key: UUID;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_address: string;
  delivery_city: string;
  delivery_area: string;
  notes?: string;
  payment_method: 'cash';
  items: {
    meal_id: UUID;
    quantity: number;
    customer_notes?: string;
    today_special_id?: UUID;
    variant_id?: UUID;
    extras?: { id: UUID; name: string; price: number }[];
  }[];
  estimated_delivery?: string; // ISO datetime string for preparation/delivery schedule
  is_scheduled?: boolean;
  scheduled_for?: string;
}

export async function placeOrder(input: PlaceOrderInput): Promise<{ orderId: UUID; orderNumber: string; isScheduled?: boolean }> {
  if (input.customer_name.trim().length < 2) throw new Error('اكتب اسم المستلم بشكل صحيح');
  if (input.delivery_area.trim().length < 2) throw new Error('اكتب اسم المنطقة بشكل صحيح');
  if (input.delivery_address.trim().length < 5) throw new Error('اكتب اسم الشارع بالتفصيل؛ رقم المبنى اختياري');
  if (input.items.length < 1) throw new Error('السلة فارغة');
  if (input.items.length > 30) throw new Error('عدد الأصناف في الطلب أكبر من الحد المسموح');
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      throw new Error('توجد كمية غير صالحة في السلة');
    }
    if ((item.customer_notes?.length ?? 0) > 500) throw new Error('ملاحظات أحد الأصناف طويلة جدًا');
    if ((item.extras?.length ?? 0) > 20) throw new Error('عدد الإضافات لأحد الأصناف أكبر من الحد المسموح');
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  handleSupabaseError(authError);
  if (!user) throw new Error('يجب تسجيل الدخول قبل إتمام الطلب');

  const payload = {
    idempotency_key: input.idempotency_key,
    payment_method: input.payment_method,
    notes: input.notes ?? null,
    scheduled_for: input.scheduled_for ?? input.estimated_delivery ?? null,
    is_scheduled: input.is_scheduled ?? false,
    delivery: {
      name: input.customer_name.trim(),
      phone: input.customer_phone.trim(),
      email: input.customer_email?.trim() || null,
      address: input.delivery_address.trim(),
      city: input.delivery_city.trim(),
      area: input.delivery_area.trim(),
    },
    items: input.items.map((item) => ({
      meal_id: item.meal_id,
      quantity: item.quantity,
      customer_notes: item.customer_notes ?? null,
      today_special_id: item.today_special_id ?? null,
      variant_id: item.variant_id ?? null,
      // Only ids are sent. Names and prices are deliberately ignored by SQL.
      extras: (item.extras ?? []).map((extra) => ({ id: extra.id })),
    })),
  };

  if (JSON.stringify(payload).length > 50_000) {
    throw new Error('حجم بيانات الطلب أكبر من الحد المسموح');
  }

  const { data, error } = await supabase.rpc('place_order_atomic_v3', {
    p_payload: payload,
  });
  handleSupabaseError(error);
  if (!data) throw new Error('لم يتم إنشاء الطلب، يرجى المحاولة مرة أخرى');
  return data as { orderId: UUID; orderNumber: string; isScheduled?: boolean };
}


export async function fetchMyOrders(
  userId: UUID,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<Order>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('orders')
    .select(ORDER_FIELDS, { count: 'exact' })
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
  handleSupabaseError(error);
  return {
    data: (data ?? []) as Order[],
    count: count ?? 0,
    page,
    pageSize,
    hasMore: from + (data?.length ?? 0) < (count ?? 0),
  };
}

export async function fetchOrderById(id: UUID): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('id', id)
    .single();
  handleSupabaseError(error);
  return data as Order;
}

export async function fetchOrderItems(orderId: UUID): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select(ORDER_ITEM_FIELDS)
    .eq('order_id', orderId)
    .order('created_at');
  handleSupabaseError(error);
  return (data ?? []) as unknown as OrderItem[];
}

export async function fetchOrderTimeline(orderId: UUID): Promise<OrderTimeline[]> {
  const { data, error } = await supabase
    .from('order_timeline')
    .select('id, order_id, status, created_by, notes, created_at')
    .eq('order_id', orderId)
    .order('created_at');
  handleSupabaseError(error);
  return (data ?? []) as OrderTimeline[];
}
