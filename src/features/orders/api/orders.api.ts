import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { Order, OrderItem, OrderTimeline, UUID } from '@/types';

const ORDER_FIELDS = `
  id, customer_id, address_id, cook_id, order_number,
  subtotal, delivery_fee, discount, tax, total,
  status, payment_method, payment_status, notes,
  estimated_delivery, created_at, updated_at
`;

const ORDER_ITEM_FIELDS = `
  id, order_id, meal_id, quantity, unit_price, total_price,
  customer_notes, today_special_id, meal_name, meal_image, created_at, updated_at,
  meal:meals(id, name, image_url, price)
`;


export interface PlaceOrderInput {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_address: string;
  delivery_city: string;
  delivery_area: string;
  notes?: string;
  payment_method: 'cash' | 'card' | 'wallet';
  items: Array<{
    meal_id: UUID;
    quantity: number;
    customer_notes?: string;
    today_special_id?: UUID;
    variant_id?: UUID;
    extras?: Array<{ id: UUID; name: string; price: number }>;
  }>;
  estimated_delivery?: string; // ISO datetime string for preparation/delivery schedule
}

export async function placeOrder(input: PlaceOrderInput): Promise<{ orderId: UUID; orderNumber: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  let lastErrorMessage = '';

  // ── Attempt 1: Atomic RPC (preferred — enforces stock, variants, locking) ──
  try {
    const rpcItems = input.items.map((i) => ({
      meal_id: i.meal_id,
      quantity: i.quantity,
      customer_notes: i.customer_notes ?? null,
      today_special_id: i.today_special_id ?? null,
      variant_id: i.variant_id ?? null,
      extras: i.extras ?? null,
    }));

    const { data, error } = await supabase.rpc('place_order_atomic', {
      p_customer_id: userId,
      p_payment_method: input.payment_method,
      p_notes: input.notes ?? null,
      p_items: rpcItems,
      p_estimated_delivery: input.estimated_delivery ?? null,
    });

    if (!error && data) {
      const result = data as { orderId: UUID; orderNumber: string };
      return result;
    }

    if (error) {
      lastErrorMessage = error.message;
      console.warn('[placeOrder] RPC failed:', error.message);
    }
  } catch (e: any) {
    lastErrorMessage = e?.message || lastErrorMessage;
    console.warn('[placeOrder] RPC threw:', e);
  }

  // ── Attempt 2: Edge Function (if deployed) ────────────────────────────────
  try {
    const { data, error } = await supabase.functions.invoke('place-order', { body: input });
    if (!error && data) return data as { orderId: UUID; orderNumber: string };
    if (error) {
      console.warn('[placeOrder] Edge function failed:', error);
    }
  } catch (e: any) {
    console.warn('[placeOrder] Edge function threw:', e);
  }

  // ── STOP: Unsafe direct client-side insert is STRICTLY PROHIBITED ──
  // If both safe server-side mechanisms fail, stop and throw an explicit Arabic retry error.
  throw new Error(lastErrorMessage || 'حدث خطأ أثناء معالجة الطلب، يرجى المحاولة مرة أخرى.');
}


export async function fetchMyOrders(userId: UUID): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
  handleSupabaseError(error);
  return (data ?? []) as Order[];
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
