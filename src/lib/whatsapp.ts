import { Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { logAnalyticsEvent } from '@/lib/analytics';
import { normalizeWhatsAppNumber } from '@/utils';

/**
 * Opens WhatsApp with a clean phone number and optional pre-filled message.
 */
export async function openWhatsApp(phone?: string | null, message?: string): Promise<void> {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const cleanNumber = normalizeWhatsAppNumber(phone);
  if (!cleanNumber) return;

  logAnalyticsEvent('whatsapp_click', { phone: cleanNumber, message });

  const defaultMsg = message ?? 'السلام عليكم، أحتاج مساعدة في تطبيق سفرة 🙏';
  const encodedMsg = encodeURIComponent(defaultMsg);

  const nativeUrl = `whatsapp://send?phone=${cleanNumber}&text=${encodedMsg}`;
  const webUrl = `https://wa.me/${cleanNumber}?text=${encodedMsg}`;

  try {
    const supported = await Linking.canOpenURL(nativeUrl);
    if (supported) {
      await Linking.openURL(nativeUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch {
    await Linking.openURL(webUrl);
  }
}
