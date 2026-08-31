// ============================================================
// SOFRA ENTERPRISE — Global Domain Types
// Aligned with 05_DATABASE_DESIGN.md
// Rule 10: Never use 'any'
// ============================================================

export type UUID = string;
export type ISODateString = string;

// ─── Order Status ────────────────────────────────────────────
export type OrderStatus =
  | 'pending_admin'
  | 'dispatching'
  | 'waiting_cook'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_admin: 'في انتظار الإدارة',
  dispatching: 'جاري تحديد الطاهي',
  waiting_cook: 'في انتظار رد الطاهي',
  accepted: 'تم القبول',
  preparing: 'قيد التحضير',
  ready: 'جاهز للتسليم',
  out_for_delivery: 'المندوب في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

export const ORDER_TIMELINE_STEPS: OrderStatus[] = [
  'pending_admin',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
];

// ─── Payment ─────────────────────────────────────────────────
export type PaymentMethod = 'cash' | 'card' | 'wallet';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

// ─── Complaint ───────────────────────────────────────────────
export type ComplaintStatus = 'open' | 'investigating' | 'resolved' | 'closed';

// ─── Review ──────────────────────────────────────────────────
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

// ─── Chat ────────────────────────────────────────────────────
export type SenderType = 'customer' | 'admin';

// ─── Notification ────────────────────────────────────────────
export type NotificationType =
  | 'order_received'
  | 'order_accepted'
  | 'order_preparing'
  | 'order_ready'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'complaint_update'
  | 'chat_reply'
  | 'promotion'
  | 'today_special';

// ─── Profile ─────────────────────────────────────────────────
export type UserRole = 'customer' | 'admin';
export type UserStatus = 'active' | 'blocked' | 'deleted';

export interface Profile {
  id: UUID;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  last_login: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Address ─────────────────────────────────────────────────
export interface CustomerAddress {
  id: UUID;
  customer_id: UUID;
  title: string;
  city: string;
  area: string;
  street: string;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Category ────────────────────────────────────────────────
export interface Category {
  id: UUID;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface Subcategory {
  id: UUID;
  category_id: UUID;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
  category?: Category;
}

// ─── Meal ────────────────────────────────────────────────────
export interface Meal {
  id: UUID;
  subcategory_id: UUID;
  name: string;
  description: string | null;
  price: number;
  estimated_preparation_time: number | null;
  image_url: string | null;
  gallery: string[] | null;
  rating: number;
  reviews_count: number;
  is_available: boolean;
  is_featured: boolean;
  is_popular: boolean;
  calories: number | null;
  sort_order?: number;
  created_at: ISODateString;
  updated_at: ISODateString;
  subcategory?: Subcategory;
  variants?: MealVariant[];
}

// ─── Meal Variant & Extras ────────────────────────────────────
export interface MealVariantExtra {
  id: UUID;
  variant_id: UUID;
  name: string;
  price: number;
  is_available: boolean;
  display_order: number;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface MealVariant {
  id: UUID;
  meal_id: UUID;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  estimated_preparation_time: number | null;
  is_available: boolean;
  is_default: boolean;
  display_order: number;
  track_stock?: boolean;
  stock_count: number | null; // null = unlimited, 0 = sold out
  is_deleted?: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
  extras?: MealVariantExtra[];
}

// ─── Cook ────────────────────────────────────────────────────
export interface Cook {
  id: UUID;
  full_name: string;
  phone: string;
  whatsapp: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  specialties: string[] | null;
  priority: number;
  status: 'available' | 'busy' | 'unavailable' | 'vacation';
  rating: number;
  acceptance_rate: number;
  completed_orders: number;
  average_preparation_time: number | null;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Order ───────────────────────────────────────────────────
export interface Order {
  id: UUID;
  customer_id: UUID;
  address_id: UUID | null;
  cook_id: UUID | null;
  order_number: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  tax: number;
  total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes: string | null;
  delivery_name?: string | null;
  delivery_phone?: string | null;
  delivery_email?: string | null;
  delivery_address?: string | null;
  delivery_city?: string | null;
  delivery_area?: string | null;
  estimated_delivery: ISODateString | null;
  is_scheduled?: boolean;
  scheduled_for?: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  customer?: Profile;
  cook?: Cook;
  address?: CustomerAddress;
}

export interface OrderItem {
  id: UUID;
  order_id: UUID;
  meal_id: UUID | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  customer_notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  meal?: Meal;
  today_special_id?: UUID;
  variant_id?: UUID;
  variant_name?: string;
  selected_extras?: { id: UUID; name: string; price: number }[] | null;
  meal_name?: string;
  meal_image?: string;
}


export interface OrderTimeline {
  id: UUID;
  order_id: UUID;
  status: OrderStatus;
  created_by: string | null;
  notes: string | null;
  created_at: ISODateString;
}

// ─── Cart ────────────────────────────────────────────────────
export interface CartItem {
  meal_id: UUID;
  name: string;
  image_url: string | null;
  price: number;
  quantity: number;
  notes: string;
  // Today Special tracking — allows atomic stock decrement on checkout
  is_today_special?: boolean;
  today_special_id?: UUID;
  // Variant & Extras tracking
  variant_id?: UUID;
  variant_name?: string;
  extras?: { id: UUID; name: string; price: number }[];
}

// ─── Available Today (Snapshot) ──────────────────────────────
export type AvailableTodayStatus = 'available' | 'sold_out' | 'expired';

export interface AvailableToday {
  id: UUID;
  meal_id: UUID | null;
  // Snapshot columns — frozen at publish time
  title: string;
  description: string | null;
  image_url: string | null;
  price: number;
  quantity: number;
  status: AvailableTodayStatus;
  is_active: boolean;
  // Scheduling
  start_time: string | null;   // 'HH:MM:SS'
  end_time: string | null;     // 'HH:MM:SS'
  expiration_date: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  meal?: Meal | null;
}

// ─── Review ──────────────────────────────────────────────────
export interface Review {
  id: UUID;
  order_id: UUID;
  customer_id: UUID;
  meal_id: UUID;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  is_pinned?: boolean;
  pin_order?: number;
  created_at: ISODateString;
  updated_at: ISODateString;
  customer?: Profile;
  meal?: Meal;
}

// ─── Complaint ───────────────────────────────────────────────
export interface Complaint {
  id: UUID;
  order_id: UUID;
  customer_id: UUID;
  title: string;
  description: string;
  status: ComplaintStatus;
  resolved_by: UUID | null;
  resolved_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  order?: Order;
}

// ─── Chat ────────────────────────────────────────────────────
export interface ChatThread {
  id: UUID;
  customer_id: UUID;
  last_message_at: ISODateString | null;
  unread_count: number;
  created_at: ISODateString;
  updated_at: ISODateString;
  customer?: Profile;
}

export interface ChatMessage {
  id: UUID;
  thread_id: UUID;
  sender_type: SenderType;
  message: string;
  attachment_url: string | null;
  is_read: boolean;
  created_at: ISODateString;
}

// ─── Notification ────────────────────────────────────────────
export interface AppNotification {
  id: UUID;
  user_id: UUID;
  title: string;
  body: string;
  type: NotificationType;
  is_read: boolean;
  created_at: ISODateString;
  // Optional deep-link payload stored in the DB's `data` JSONB column
  data?: Record<string, string> | null;
}

// ─── API Response ────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  message: string;
}

// ─── Pagination ──────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// ─── Notification Preferences ────────────────────────────────
export interface NotificationPreferences {
  user_id: UUID;
  notify_specials: boolean;
  notify_orders: boolean;
  notify_chat: boolean;
  notify_promos: boolean;
  target_cities: string[] | null;
  updated_at: ISODateString;
}

// ─── Order Rating ─────────────────────────────────────────────
export interface OrderRating {
  id: UUID;
  order_id: UUID;
  customer_id: UUID;
  cook_id: UUID | null;
  food_rating: number;      // 1–5
  delivery_rating: number;  // 1–5
  overall_rating: number;   // 1–5
  comment: string | null;
  created_at: ISODateString;
}

// ─── Admin Read State ─────────────────────────────────────────
export type AdminSection = 'orders' | 'chat' | 'notifications' | 'users';

export interface AdminReadState {
  id: UUID;
  admin_id: UUID;
  section: AdminSection;
  last_read_at: ISODateString;
  unread_count: number;
}

// ─── Cook Performance (from DB view cook_performance) ─────────
export interface CookPerformance {
  id: UUID;
  full_name: string;
  status: string;
  rating: number;
  completed_orders: number;
  average_preparation_time: number | null;
  avg_food_rating: number;
  avg_delivery_rating: number;
  avg_overall_rating: number;
  review_count: number;
  preferred_count: number;     // Customers who set this cook as preferred
  returning_customers: number; // Customers with 2+ delivered orders from this cook
}

// ─── Profile extended with preferred cook ─────────────────────
export interface ProfileWithPreferredCook extends Profile {
  preferred_cook_id: UUID | null;
}
