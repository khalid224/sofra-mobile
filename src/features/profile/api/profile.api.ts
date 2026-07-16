import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { CustomerAddress, Profile, UUID } from '@/types';

const ADDRESS_FIELDS = `
  id, customer_id, title, city, area, street, building,
  floor, apartment, landmark, latitude, longitude,
  is_default, created_at, updated_at
`;

export async function fetchProfile(userId: UUID): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, phone, full_name, avatar_url, role, status, last_login, created_at, updated_at')
    .eq('id', userId)
    .single();
  handleSupabaseError(error);
  return data as Profile;
}

export async function updateProfile(userId: UUID, updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);
  handleSupabaseError(error);
}

export async function fetchAddresses(customerId: UUID): Promise<CustomerAddress[]> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select(ADDRESS_FIELDS)
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false });
  handleSupabaseError(error);
  return (data ?? []) as CustomerAddress[];
}

export interface CreateAddressInput {
  title: string;
  city: string;
  area: string;
  street: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  is_default?: boolean;
}

export async function createAddress(customerId: UUID, input: CreateAddressInput): Promise<CustomerAddress> {
  if (input.is_default) {
    await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId);
  }
  const { data, error } = await supabase
    .from('customer_addresses')
    .insert({ customer_id: customerId, ...input })
    .select(ADDRESS_FIELDS)
    .single();
  handleSupabaseError(error);
  return data as CustomerAddress;
}

export async function deleteAddress(id: UUID): Promise<void> {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
  handleSupabaseError(error);
}

export async function setDefaultAddress(customerId: UUID, addressId: UUID): Promise<void> {
  await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId);
  const { error } = await supabase.from('customer_addresses').update({ is_default: true }).eq('id', addressId);
  handleSupabaseError(error);
}
