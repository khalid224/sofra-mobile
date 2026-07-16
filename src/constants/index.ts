export const APP_NAME = 'sofra';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_CART_QUANTITY = 20;
export const MIN_ORDER_AMOUNT = 0;
export const CHAT_POLL_INTERVAL = 5000; // 5 seconds
export const ORDER_POLL_INTERVAL = 6000; // 6 seconds
export const DASHBOARD_REFRESH_INTERVAL = 30000;

export const PAYMENT_METHOD_LABELS = {
  cash: 'كاش عند الاستلام',
  card: 'بطاقة بنكية',
  wallet: 'محفظة إلكترونية',
} as const;

export const COMPLAINT_STATUS_LABELS = {
  open: 'مفتوحة',
  investigating: 'قيد الفحص',
  resolved: 'تم الحل',
  closed: 'مغلقة',
} as const;

export const COMPLAINT_STATUS_COLORS = {
  open: '#DF2225',
  investigating: '#F2A618',
  resolved: '#399D57',
  closed: '#71574B',
} as const;

export const STORAGE_KEYS = {
  CART: 'sofra_cart_v3',
  THEME: 'sofra_theme_mode',
  CHAT_TOKEN: 'sofra_chat_token',
  CUSTOMER_PROFILE: 'sofra_customer_profile',
  RECENT_SEARCHES: 'sofra_recent_searches',
  LAST_ADDRESS: 'sofra_last_address',
  ONBOARDING: 'sofra_onboarding_done',
} as const;

export const QUERY_KEYS = {
  PROFILE: 'profile',
  CATEGORIES: 'categories',
  MEALS: 'meals',
  MEAL: 'meal',
  POPULAR_MEALS: 'popular-meals',
  FEATURED_MEALS: 'featured-meals',
  MY_ORDERS: 'my-orders',
  ORDER: 'order',
  ORDER_TIMELINE: 'order-timeline',
  CHAT_THREAD: 'chat-thread',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  ADDRESSES: 'addresses',
  REVIEWS: 'reviews',
  COMPLAINTS: 'complaints',
  SEARCH: 'search',
  FAVORITES: 'favorites',
  AVAILABLE_TODAY: 'available-today',
  RESTAURANT_STATUS: 'restaurant-status',
} as const;

