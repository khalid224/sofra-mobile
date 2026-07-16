import { supabase } from '@/lib/supabase';

export interface AppSettings {
  delivery_fee: number;
  min_order_amount: number;
  whatsapp_number: string;
  business_phone: string;
  business_address: string;
  delivery_time_estimate: string;
  maintenance_mode: boolean;
  privacy_policy_url: string;
  terms_url: string;
}

export async function fetchSettings(): Promise<Partial<AppSettings>> {
  const { data } = await supabase.from('app_settings').select('key, value');
  if (!data) return {};
  return Object.fromEntries(data.map((r: { key: string; value: unknown }) => [r.key, r.value])) as Partial<AppSettings>;
}
