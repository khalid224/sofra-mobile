import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { OrderStatus } from '@/types';

export function formatEGP(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd MMM yyyy — hh:mm a', { locale: ar });
}

export function formatTimeAgo(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ar });
}

export function formatShortDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ar });
}

export function normalizeWhatsAppNumber(phone?: string | null): string {
  if (!phone) return '201002422589';
  let digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    digits = '2' + digits; // Convert local Egyptian 01xxxxxxxx to international 201xxxxxxxx
  }
  return digits || '201002422589';
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizeWhatsAppNumber(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function generateOrderNumber(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

export function validateEgyptianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s+/g, '');
  return /^(\+20|0020|0)?1[0-9]{9}$/.test(cleaned);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getStatusColor(
  status: OrderStatus,
  colors: { primary: string; success: string; warning: string; destructive: string; mutedForeground: string },
): string {
  const map: Record<OrderStatus, string> = {
    pending_admin: colors.warning,
    dispatching: colors.warning,
    waiting_cook: colors.warning,
    accepted: colors.primary,
    preparing: colors.primary,
    ready: colors.success,
    out_for_delivery: colors.success,
    delivered: colors.success,
    cancelled: colors.destructive,
  };
  return map[status] ?? colors.mutedForeground;
}

export function isOrderActive(status: OrderStatus): boolean {
  return !['delivered', 'cancelled'].includes(status);
}

export function getStepIndex(status: OrderStatus): number {
  const steps: OrderStatus[] = [
    'pending_admin',
    'accepted',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
  ];
  return steps.indexOf(status);
}
