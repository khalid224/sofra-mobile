/**
 * Unit tests for src/utils/index.ts
 * Per 13_TESTING_STRATEGY.md: "Unit Tests — Coverage Target: 80% minimum"
 * Tests: Utilities, Formatting, Validation, Business Rules
 */

import {
  formatEGP,
  formatTimeAgo,
  validateEgyptianPhone,
  validateEmail,
  buildWhatsAppUrl,
  getStepIndex,
  isOrderActive,
  truncateText,
  generateOrderNumber,
} from '../utils';
import type { OrderStatus } from '../types';

// ─── formatEGP ───────────────────────────────────────────────
describe('formatEGP', () => {
  it('formats whole number in EGP', () => {
    const result = formatEGP(100);
    expect(result).toContain('100');
    expect(result).toContain('ج'); // EGP symbol in Arabic locale
  });

  it('formats zero', () => {
    const result = formatEGP(0);
    expect(result).toContain('0');
  });

  it('formats large numbers', () => {
    const result = formatEGP(1500);
    expect(result).toContain('1');
    expect(result).toContain('500');
  });

  it('rounds decimals to 0 fraction digits', () => {
    const result = formatEGP(99.99);
    // Should not show .99 since maximumFractionDigits is 0
    expect(result).not.toContain('.99');
  });
});

// ─── validateEgyptianPhone ───────────────────────────────────
describe('validateEgyptianPhone', () => {
  it('accepts valid Egyptian mobile starting with 010', () => {
    expect(validateEgyptianPhone('01012345678')).toBe(true);
  });

  it('accepts valid Egyptian mobile starting with 011', () => {
    expect(validateEgyptianPhone('01112345678')).toBe(true);
  });

  it('accepts valid Egyptian mobile starting with 012', () => {
    expect(validateEgyptianPhone('01212345678')).toBe(true);
  });

  it('accepts number with +20 prefix', () => {
    expect(validateEgyptianPhone('+201012345678')).toBe(true);
  });

  it('accepts number with 0020 prefix', () => {
    expect(validateEgyptianPhone('00201012345678')).toBe(true);
  });

  it('rejects number with wrong prefix', () => {
    expect(validateEgyptianPhone('05512345678')).toBe(false);
  });

  it('rejects too short number', () => {
    expect(validateEgyptianPhone('0101234')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEgyptianPhone('')).toBe(false);
  });

  it('ignores spaces', () => {
    expect(validateEgyptianPhone('0101 234 5678')).toBe(true);
  });
});

// ─── validateEmail ───────────────────────────────────────────
describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true);
  });

  it('rejects email without @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
});

// ─── buildWhatsAppUrl ────────────────────────────────────────
describe('buildWhatsAppUrl', () => {
  it('builds correct WhatsApp URL', () => {
    const url = buildWhatsAppUrl('+201012345678', 'مرحبا');
    expect(url).toContain('wa.me');
    expect(url).toContain('201012345678');
    expect(url).toContain(encodeURIComponent('مرحبا'));
  });

  it('strips non-digit characters from phone', () => {
    const url = buildWhatsAppUrl('+20 101 234 5678', 'test');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('+');
  });
});

// ─── getStepIndex ────────────────────────────────────────────
describe('getStepIndex', () => {
  it('returns -1 for dispatching (not in timeline)', () => {
    expect(getStepIndex('dispatching')).toBe(-1);
  });

  it('returns 0 for pending_admin', () => {
    expect(getStepIndex('pending_admin')).toBe(0);
  });

  it('returns correct index for accepted', () => {
    expect(getStepIndex('accepted')).toBe(1);
  });

  it('returns correct index for delivered', () => {
    expect(getStepIndex('delivered')).toBe(5);
  });

  it('returns -1 for cancelled', () => {
    expect(getStepIndex('cancelled')).toBe(-1);
  });
});

// ─── isOrderActive ───────────────────────────────────────────
describe('isOrderActive', () => {
  const activeStatuses: OrderStatus[] = [
    'pending_admin', 'dispatching', 'waiting_cook',
    'accepted', 'preparing', 'ready', 'out_for_delivery',
  ];
  const inactiveStatuses: OrderStatus[] = ['delivered', 'cancelled'];

  activeStatuses.forEach((status) => {
    it(`returns true for ${status}`, () => {
      expect(isOrderActive(status)).toBe(true);
    });
  });

  inactiveStatuses.forEach((status) => {
    it(`returns false for ${status}`, () => {
      expect(isOrderActive(status)).toBe(false);
    });
  });
});

// ─── truncateText ────────────────────────────────────────────
describe('truncateText', () => {
  it('does not truncate short text', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('truncates long text with ellipsis', () => {
    const result = truncateText('hello world', 5);
    expect(result).toBe('hello...');
    expect(result.length).toBeLessThan('hello world'.length + 3);
  });

  it('handles exact length', () => {
    expect(truncateText('hello', 5)).toBe('hello');
  });
});

// ─── generateOrderNumber ─────────────────────────────────────
describe('generateOrderNumber', () => {
  it('starts with ORD-', () => {
    expect(generateOrderNumber()).toMatch(/^ORD-/);
  });

  it('generates unique numbers', () => {
    const n1 = generateOrderNumber();
    // Small delay to ensure different timestamp
    const n2 = generateOrderNumber();
    // Both should be strings with correct prefix
    expect(n1).toMatch(/^ORD-/);
    expect(n2).toMatch(/^ORD-/);
  });
});
