import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem, UUID } from '@/types';
import { STORAGE_KEYS, MAX_CART_QUANTITY } from '@/constants';
import { supabase } from '@/lib/supabase';

// Helper to get unique identifier for cart items
export function getCartItemKey(item: {
  meal_id: UUID;
  variant_id?: UUID;
  extras?: { id: UUID }[];
}): string {
  const parts = [item.meal_id];
  if (item.variant_id) {
    parts.push(item.variant_id);
  }
  if (item.extras && item.extras.length > 0) {
    const sortedExtraIds = [...item.extras].map((e) => e.id).sort().join(',');
    if (sortedExtraIds) parts.push(sortedExtraIds);
  }
  return parts.join('_');
}

// ─── State ───────────────────────────────────────────────────
interface CartState {
  items: CartItem[];
  isReady: boolean;
}

type CartAction =
  | { type: 'LOADED'; items: CartItem[] }
  | { type: 'ADD'; item: CartItem }
  | { type: 'REMOVE'; key: UUID }
  | { type: 'SET_QUANTITY'; key: UUID; quantity: number }
  | { type: 'SET_NOTES'; key: UUID; notes: string }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'LOADED':
      return { items: action.items, isReady: true };
    case 'ADD': {
      const targetKey = getCartItemKey(action.item);
      const existing = state.items.find((i) => getCartItemKey(i) === targetKey);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            getCartItemKey(i) === targetKey
              ? { ...i, quantity: Math.min(i.quantity + action.item.quantity, MAX_CART_QUANTITY) }
              : i,
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter((i) => getCartItemKey(i) !== action.key) };
    case 'SET_QUANTITY':
      return {
        ...state,
        items: state.items.map((i) =>
          getCartItemKey(i) === action.key
            ? { ...i, quantity: Math.max(1, Math.min(action.quantity, MAX_CART_QUANTITY)) }
            : i,
        ),
      };
    case 'SET_NOTES':
      return {
        ...state,
        items: state.items.map((i) =>
          getCartItemKey(i) === action.key ? { ...i, notes: action.notes } : i,
        ),
      };
    case 'CLEAR':
      return { ...state, items: [] };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────
interface CartContextValue {
  items: CartItem[];
  isReady: boolean;
  totalItems: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  removeItem: (key: UUID) => void;
  setQuantity: (key: UUID, quantity: number) => void;
  setNotes: (key: UUID, notes: string) => void;
  clear: () => void;
  hasItem: (key: UUID) => boolean;
  getItem: (key: UUID) => CartItem | undefined;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isReady: false });

  // Load persisted cart
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.CART)
      .then((raw) => {
        const items: CartItem[] = raw ? (JSON.parse(raw) as CartItem[]) : [];
        dispatch({ type: 'LOADED', items });
      })
      .catch(() => dispatch({ type: 'LOADED', items: [] }));
  }, []);

  // Clear cart in-memory state when user signs out
  useEffect(() => {
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'CLEAR' });
      }
    });
    return () => authSub.subscription.unsubscribe();
  }, []);

  // Persist on every change
  useEffect(() => {
    if (!state.isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.items)).catch(() => undefined);
  }, [state.items, state.isReady]);

  const addItem = useCallback((item: CartItem) => dispatch({ type: 'ADD', item }), []);
  const removeItem = useCallback((key: UUID) => dispatch({ type: 'REMOVE', key }), []);
  const setQuantity = useCallback(
    (key: UUID, quantity: number) => dispatch({ type: 'SET_QUANTITY', key, quantity }),
    [],
  );
  const setNotes = useCallback(
    (key: UUID, notes: string) => dispatch({ type: 'SET_NOTES', key, notes }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);
  const hasItem = useCallback((key: UUID) => state.items.some((i) => getCartItemKey(i) === key), [state.items]);
  const getItem = useCallback((key: UUID) => state.items.find((i) => getCartItemKey(i) === key), [state.items]);

  const totalItems = useMemo(() => state.items.reduce((sum, i) => sum + i.quantity, 0), [state.items]);
  const subtotal = useMemo(
    () => state.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [state.items],
  );

  return (
    <CartContext.Provider
      value={{ items: state.items, isReady: state.isReady, totalItems, subtotal, addItem, removeItem, setQuantity, setNotes, clear, hasItem, getItem }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
