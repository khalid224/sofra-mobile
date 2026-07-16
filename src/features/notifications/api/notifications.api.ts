import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { AppNotification, UUID } from '@/types';

const NOTIFICATION_FIELDS = `id, user_id, title, body, type, is_read, created_at`;

export async function fetchNotifications(userId: UUID): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_FIELDS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  handleSupabaseError(error);
  return (data ?? []) as AppNotification[];
}

export async function fetchUnreadCount(userId: UUID): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  handleSupabaseError(error);
  return count ?? 0;
}

export async function markAllRead(userId: UUID): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  handleSupabaseError(error);
}

export async function markOneRead(id: UUID): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  handleSupabaseError(error);
}
