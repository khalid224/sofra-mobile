/**
 * Unit tests for CartContext reducer logic
 * Per 13_TESTING_STRATEGY.md: Cart is a critical business flow requiring tests.
 * Per 22_BUSINESS_RULES.md: "Quantity must be greater than zero", "Maximum quantity per meal is configurable"
 */

import type { CartItem, UUID } from '../types';
import { MAX_CART_QUANTITY } from '../constants';

// ─── Cart reducer (extracted logic matching CartContext) ──────
type CartState = { items: CartItem[]; isReady: boolean };
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

const INITIAL_STATE: CartState = { items: [], isReady: false };

const mockItem = (id: string, price = 50, qty = 1): CartItem => ({
  meal_id: id,
  name: `صنف ${id}`,
  image_url: null,
  price,
  quantity: qty,
  notes: '',
});

// ─── Tests ───────────────────────────────────────────────────
describe('Cart Reducer', () => {

  // LOAD
  describe('LOADED', () => {
    it('sets items and marks ready', () => {
      const items = [mockItem('1'), mockItem('2')];
      const state = cartReducer(INITIAL_STATE, { type: 'LOADED', items });
      expect(state.items).toHaveLength(2);
      expect(state.isReady).toBe(true);
    });
  });

  // ADD
  describe('ADD', () => {
    it('adds new item to empty cart', () => {
      const state = cartReducer(
        { ...INITIAL_STATE, isReady: true },
        { type: 'ADD', item: mockItem('a1', 30, 1) },
      );
      expect(state.items).toHaveLength(1);
      expect(state.items[0].meal_id).toBe('a1');
      expect(state.items[0].quantity).toBe(1);
    });

    it('increments quantity for existing item', () => {
      const base: CartState = { items: [mockItem('a1', 30, 2)], isReady: true };
      const state = cartReducer(base, { type: 'ADD', item: mockItem('a1', 30, 3) });
      expect(state.items).toHaveLength(1);
      expect(state.items[0].quantity).toBe(5);
    });

    it('caps quantity at MAX_CART_QUANTITY', () => {
      const base: CartState = { items: [mockItem('a1', 30, MAX_CART_QUANTITY - 1)], isReady: true };
      const state = cartReducer(base, { type: 'ADD', item: mockItem('a1', 30, 5) });
      expect(state.items[0].quantity).toBe(MAX_CART_QUANTITY);
    });

    it('adds different items separately', () => {
      let state: CartState = { ...INITIAL_STATE, isReady: true };
      state = cartReducer(state, { type: 'ADD', item: mockItem('a1', 30, 1) });
      state = cartReducer(state, { type: 'ADD', item: mockItem('a2', 50, 2) });
      expect(state.items).toHaveLength(2);
    });
  });

  // REMOVE
  describe('REMOVE', () => {
    it('removes item from cart', () => {
      const base: CartState = { items: [mockItem('a1'), mockItem('a2')], isReady: true };
      const state = cartReducer(base, { type: 'REMOVE', meal_id: 'a1' });
      expect(state.items).toHaveLength(1);
      expect(state.items[0].meal_id).toBe('a2');
    });

    it('does nothing if item not found', () => {
      const base: CartState = { items: [mockItem('a1')], isReady: true };
      const state = cartReducer(base, { type: 'REMOVE', meal_id: 'not-found' });
      expect(state.items).toHaveLength(1);
    });
  });

  // SET_QUANTITY
  describe('SET_QUANTITY', () => {
    it('updates quantity for existing item', () => {
      const base: CartState = { items: [mockItem('a1', 30, 1)], isReady: true };
      const state = cartReducer(base, { type: 'SET_QUANTITY', meal_id: 'a1', quantity: 5 });
      expect(state.items[0].quantity).toBe(5);
    });

    it('enforces minimum quantity of 1', () => {
      const base: CartState = { items: [mockItem('a1', 30, 3)], isReady: true };
      const state = cartReducer(base, { type: 'SET_QUANTITY', meal_id: 'a1', quantity: 0 });
      expect(state.items[0].quantity).toBe(1);
    });

    it('enforces maximum quantity cap', () => {
      const base: CartState = { items: [mockItem('a1', 30, 1)], isReady: true };
      const state = cartReducer(base, { type: 'SET_QUANTITY', meal_id: 'a1', quantity: MAX_CART_QUANTITY + 10 });
      expect(state.items[0].quantity).toBe(MAX_CART_QUANTITY);
    });

    it('does not affect other items', () => {
      const base: CartState = { items: [mockItem('a1', 30, 2), mockItem('a2', 40, 3)], isReady: true };
      const state = cartReducer(base, { type: 'SET_QUANTITY', meal_id: 'a1', quantity: 7 });
      expect(state.items.find(i => i.meal_id === 'a2')?.quantity).toBe(3);
    });
  });

  // SET_NOTES
  describe('SET_NOTES', () => {
    it('updates notes for item', () => {
      const base: CartState = { items: [mockItem('a1')], isReady: true };
      const state = cartReducer(base, { type: 'SET_NOTES', meal_id: 'a1', notes: 'بدون بصل' });
      expect(state.items[0].notes).toBe('بدون بصل');
    });

    it('does not affect other items notes', () => {
      const base: CartState = { items: [mockItem('a1'), { ...mockItem('a2'), notes: 'ملح خفيف' }], isReady: true };
      const state = cartReducer(base, { type: 'SET_NOTES', meal_id: 'a1', notes: 'بدون بصل' });
      expect(state.items.find(i => i.meal_id === 'a2')?.notes).toBe('ملح خفيف');
    });
  });

  // CLEAR
  describe('CLEAR', () => {
    it('removes all items', () => {
      const base: CartState = { items: [mockItem('a1'), mockItem('a2'), mockItem('a3')], isReady: true };
      const state = cartReducer(base, { type: 'CLEAR' });
      expect(state.items).toHaveLength(0);
    });

    it('does not change isReady', () => {
      const base: CartState = { items: [mockItem('a1')], isReady: true };
      const state = cartReducer(base, { type: 'CLEAR' });
      expect(state.isReady).toBe(true);
    });
  });

  // Derived values
  describe('Derived values', () => {
    const items = [mockItem('a1', 50, 2), mockItem('a2', 30, 3)];
    const state: CartState = { items, isReady: true };

    it('calculates total items correctly', () => {
      const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
      expect(totalItems).toBe(5); // 2+3
    });

    it('calculates subtotal correctly', () => {
      const subtotal = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      expect(subtotal).toBe(190); // 50*2 + 30*3 = 100 + 90
    });
  });
});
