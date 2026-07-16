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
    // Optional: links to an available_today row for atomic stock decrement
    today_special_id?: UUID;
  }>;
  estimated_delivery?: string; // ISO datetime string for preparation/delivery schedule
}

export async function placeOrder(input: PlaceOrderInput): Promise<{ orderId: UUID; orderNumber: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  // ── Attempt 1: Atomic RPC (preferred — prevents race conditions on today specials) ──
  try {
    const rpcItems = input.items.map((i) => ({
      meal_id: i.meal_id,
      quantity: i.quantity,
      customer_notes: i.customer_notes ?? null,
      today_special_id: i.today_special_id ?? null,
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
    console.warn('[placeOrder] RPC failed, falling back to client-side insert:', error?.message);
  } catch (e) {
    console.warn('[placeOrder] RPC threw, falling back to client-side insert:', e);
  }


  // ── Attempt 2: Edge Function (if deployed) ────────────────────────────────
  try {
    const { data, error } = await supabase.functions.invoke('place-order', { body: input });
    if (!error && data) return data as { orderId: UUID; orderNumber: string };
    console.warn('[placeOrder] Edge function failed, using client-side fallback:', error);
  } catch (e) {
    console.warn('[placeOrder] Edge function threw:', e);
  }

  // ── Attempt 3: Direct client-side insert (fallback, no stock decrement for specials) ──
  const mealIds = [...new Set(input.items.map((i) => i.meal_id))];
  const { data: meals, error: mealsErr } = await supabase
    .from('meals')
    .select('id, name, price, is_available')
    .in('id', mealIds);

  if (mealsErr || !meals) {
    throw new Error(mealsErr?.message ?? 'فشل الحصول على بيانات الوجبات');
  }

  const mealMap = new Map(meals.map((m) => [m.id, m]));

  let subtotal = 0;
  const orderItems = input.items.map((item) => {
    const meal = mealMap.get(item.meal_id);
    if (!meal) throw new Error(`الصنف غير موجود: ${item.meal_id}`);
    if (!meal.is_available) throw new Error(`الصنف غير متاح: ${meal.name}`);
    const unitPrice = Number(meal.price);
    subtotal += unitPrice * item.quantity;
    return {
      meal_id: item.meal_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      total_price: unitPrice * item.quantity,
      customer_notes: item.customer_notes ?? null,
    };
  });

  const { data: feeSetting } = await supabase
    .from('app_settings').select('value').eq('key', 'delivery_fee').maybeSingle();
  const deliveryFee = Number(feeSetting?.value ?? 25);
  const total = subtotal + deliveryFee;
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_id: userId, order_number: orderNumber,
      subtotal, delivery_fee: deliveryFee, discount: 0, tax: 0, total,
      status: 'pending_admin', payment_method: input.payment_method,
      payment_status: 'pending', notes: input.notes ?? null,
      estimated_delivery: input.estimated_delivery ?? null,
    })
    .select('id').single();


  if (orderErr || !order) throw new Error(orderErr?.message ?? 'فشل إنشاء الطلب');

  const orderId = order.id;

  await supabase.from('order_items').insert(orderItems.map((oi) => ({ ...oi, order_id: orderId })));
  await supabase.from('order_timeline').insert({ order_id: orderId, status: 'pending_admin', created_by: userId ?? 'system', notes: 'تم إنشاء الطلب' });
  if (userId) {
    await supabase.from('notifications').insert({ user_id: userId, title: 'تم استلام طلبك ✓', body: `طلبك #${orderNumber} قيد المراجعة.`, type: 'order_received', is_read: false });
  }

  return { orderId, orderNumber };
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
