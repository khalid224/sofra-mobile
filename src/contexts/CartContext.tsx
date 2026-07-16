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

// ─── State ───────────────────────────────────────────────────
interface CartState {
  items: CartItem[];
  isReady: boolean;
}

type CartAction =
  | { type: 'LOADED'; items: CartItem[] }
  | { type: 'ADD'; item: CartItem }
  | { type: 'REMOVE'; meal_id: UUID }
  | { type: 'SET_QUANTITY'; meal_id: UUID; quantity: number }
  | { type: 'SET_NOTES'; meal_id: UUID; notes: string }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'LOADED':
      return { items: action.items, isReady: true };
    case 'ADD': {
      const existing = state.items.find((i) => i.meal_id === action.item.meal_id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.meal_id === action.item.meal_id
              ? { ...i, quantity: Math.min(i.quantity + action.item.quantity, MAX_CART_QUANTITY) }
              : i,
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter((i) => i.meal_id !== action.meal_id) };
    case 'SET_QUANTITY':
      return {
        ...state,
        items: state.items.map((i) =>
          i.meal_id === action.meal_id
            ? { ...i, quantity: Math.max(1, Math.min(action.quantity, MAX_CART_QUANTITY)) }
            : i,
        ),
      };
    case 'SET_NOTES':
      return {
        ...state,
        items: state.items.map((i) =>
          i.meal_id === action.meal_id ? { ...i, notes: action.notes } : i,
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
  removeItem: (meal_id: UUID) => void;
  setQuantity: (meal_id: UUID, quantity: number) => void;
  setNotes: (meal_id: UUID, notes: string) => void;
  clear: () => void;
  hasItem: (meal_id: UUID) => boolean;
  getItem: (meal_id: UUID) => CartItem | undefined;
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

  // Persist on every change
  useEffect(() => {
    if (!state.isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.items)).catch(() => undefined);
  }, [state.items, state.isReady]);

  const addItem = useCallback((item: CartItem) => dispatch({ type: 'ADD', item }), []);
  const removeItem = useCallback((meal_id: UUID) => dispatch({ type: 'REMOVE', meal_id }), []);
  const setQuantity = useCallback(
    (meal_id: UUID, quantity: number) => dispatch({ type: 'SET_QUANTITY', meal_id, quantity }),
    [],
  );
  const setNotes = useCallback(
    (meal_id: UUID, notes: string) => dispatch({ type: 'SET_NOTES', meal_id, notes }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);
  const hasItem = useCallback((meal_id: UUID) => state.items.some((i) => i.meal_id === meal_id), [state.items]);
  const getItem = useCallback((meal_id: UUID) => state.items.find((i) => i.meal_id === meal_id), [state.items]);

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
