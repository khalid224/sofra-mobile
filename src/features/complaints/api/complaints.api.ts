import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { Complaint, UUID } from '@/types';

const COMPLAINT_FIELDS = `
  id, order_id, customer_id, title, description,
  status, resolved_by, resolved_at, created_at, updated_at
`;

export interface CreateComplaintInput {
  order_id: UUID;
  title: string;
  description: string;
}

export async function createComplaint(customerId: UUID, input: CreateComplaintInput): Promise<void> {
  const { error } = await supabase.from('complaints').insert({
    order_id: input.order_id,
    customer_id: customerId,
    title: input.title,
    description: input.description,
    status: 'open',
  });
  handleSupabaseError(error);
}

export async function fetchMyComplaints(customerId: UUID): Promise<Complaint[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select(COMPLAINT_FIELDS)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  handleSupabaseError(error);
  return (data ?? []) as Complaint[];
}
