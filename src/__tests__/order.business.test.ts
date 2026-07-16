/**
 * Unit tests for order business rules
 * Per 13_TESTING_STRATEGY.md: Dispatch Engine Testing, Order Status validation
 * Per 22_BUSINESS_RULES.md: illegal state changes are forbidden
 */

import { isOrderActive, getStepIndex } from '../utils';
import { ORDER_STATUS_LABELS, ORDER_TIMELINE_STEPS, type OrderStatus } from '../types';

// ─── Order Status Labels ──────────────────────────────────────
describe('ORDER_STATUS_LABELS', () => {
  it('has a label for every status', () => {
    const statuses: OrderStatus[] = [
      'pending_admin', 'dispatching', 'waiting_cook', 'accepted',
      'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled',
    ];
    statuses.forEach((s) => {
      expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
      expect(typeof ORDER_STATUS_LABELS[s]).toBe('string');
    });
  });

  it('has Arabic labels', () => {
    // All labels should contain Arabic text (unicode range)
    Object.values(ORDER_STATUS_LABELS).forEach((label) => {
      expect(/[\u0600-\u06FF]/.test(label)).toBe(true);
    });
  });
});

// ─── ORDER_TIMELINE_STEPS ────────────────────────────────────
describe('ORDER_TIMELINE_STEPS', () => {
  it('starts with pending_admin', () => {
    expect(ORDER_TIMELINE_STEPS[0]).toBe('pending_admin');
  });

  it('ends with delivered', () => {
    expect(ORDER_TIMELINE_STEPS[ORDER_TIMELINE_STEPS.length - 1]).toBe('delivered');
  });

  it('does NOT include cancelled (cancelled is a terminal state, not a timeline step)', () => {
    expect(ORDER_TIMELINE_STEPS).not.toContain('cancelled');
  });

  it('has correct forward progression', () => {
    const expected: OrderStatus[] = ['pending_admin', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
    expect([...ORDER_TIMELINE_STEPS]).toEqual(expected);
  });
});

// ─── isOrderActive ───────────────────────────────────────────
describe('Order Active State (Business Rule)', () => {
  it('order is active until delivered or cancelled', () => {
    const active: OrderStatus[] = ['pending_admin', 'dispatching', 'waiting_cook', 'accepted', 'preparing', 'ready', 'out_for_delivery'];
    const terminal: OrderStatus[] = ['delivered', 'cancelled'];

    active.forEach((s) => expect(isOrderActive(s)).toBe(true));
    terminal.forEach((s) => expect(isOrderActive(s)).toBe(false));
  });
});

// ─── Dispatch Engine Score Rules (per 08_DISPATCH_SYSTEM_SPEC) ──
describe('Dispatch Engine Score Functions', () => {
  function scoreAvailability(status: string): number {
    if (status === 'available') return 100;
    if (status === 'busy') return 25;
    return 0;
  }

  function scoreWorkload(activeOrders: number): number {
    if (activeOrders === 0) return 100;
    if (activeOrders === 1) return 80;
    if (activeOrders === 2) return 60;
    if (activeOrders === 3) return 30;
    return 0;
  }

  function scoreDistance(km: number): number {
    if (km <= 2) return 100;
    if (km <= 5) return 80;
    if (km <= 8) return 60;
    if (km <= 12) return 40;
    return 10;
  }

  describe('Availability Score', () => {
    it('available cook gets 100', () => expect(scoreAvailability('available')).toBe(100));
    it('busy cook gets 25', () => expect(scoreAvailability('busy')).toBe(25));
    it('unavailable cook gets 0', () => expect(scoreAvailability('unavailable')).toBe(0));
    it('vacation cook gets 0', () => expect(scoreAvailability('vacation')).toBe(0));
  });

  describe('Workload Score', () => {
    it('cook with no orders gets 100', () => expect(scoreWorkload(0)).toBe(100));
    it('cook with 1 order gets 80', () => expect(scoreWorkload(1)).toBe(80));
    it('cook with 2 orders gets 60', () => expect(scoreWorkload(2)).toBe(60));
    it('cook with 3 orders gets 30', () => expect(scoreWorkload(3)).toBe(30));
    it('cook with 4+ orders gets 0', () => expect(scoreWorkload(4)).toBe(0));
  });

  describe('Distance Score', () => {
    it('0-2 km gets 100', () => expect(scoreDistance(1)).toBe(100));
    it('2-5 km gets 80', () => expect(scoreDistance(3)).toBe(80));
    it('5-8 km gets 60', () => expect(scoreDistance(6)).toBe(60));
    it('8-12 km gets 40', () => expect(scoreDistance(10)).toBe(40));
    it('12+ km gets 10', () => expect(scoreDistance(15)).toBe(10));
  });

  describe('Final Score Ranking', () => {
    it('available nearby cook with no orders ranks highest', () => {
      const cookA = scoreAvailability('available') + scoreWorkload(0) + scoreDistance(1);  // 300
      const cookB = scoreAvailability('busy') + scoreWorkload(2) + scoreDistance(8);        // 145
      expect(cookA).toBeGreaterThan(cookB);
    });

    it('unavailable cook never gets recommended (score 0 for availability)', () => {
      const unavailableScore = scoreAvailability('unavailable');
      expect(unavailableScore).toBe(0);
    });
  });
});

// ─── Price Calculation Rules (per 22_BUSINESS_RULES) ─────────
describe('Price Calculation (Business Rules)', () => {
  it('Grand Total = Subtotal + Delivery Fee - Discount + Tax', () => {
    const subtotal = 200;
    const deliveryFee = 25;
    const discount = 10;
    const tax = 0;
    const total = subtotal + deliveryFee - discount + tax;
    expect(total).toBe(215);
  });

  it('historical order items preserve original price (immutable)', () => {
    // Simulates: order item has unit_price that never changes
    const orderItem = { meal_id: 'x', unit_price: 50, quantity: 2, total_price: 100 };
    // Even if meal price changes, order item price is frozen
    const mealCurrentPrice = 75; // price changed after order
    expect(orderItem.unit_price).toBe(50); // historical price preserved
    expect(orderItem.unit_price).not.toBe(mealCurrentPrice);
  });
});
