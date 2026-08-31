import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { AppNotification, PaginatedResponse, UUID } from '@/types';

const NOTIFICATION_FIELDS = `id, user_id, title, body, type, is_read, created_at, data`;

export async function fetchNotifications(
  userId: UUID,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<AppNotification>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('notifications')
    .select(NOTIFICATION_FIELDS, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error && error.message.includes('column notifications.data does not exist')) {
    console.warn('[notifications.api] data column missing, querying basic fields');
    const fallbackRes = await supabase
      .from('notifications')
      .select('id, user_id, title, body, type, is_read, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    handleSupabaseError(fallbackRes.error);
    return {
      data: (fallbackRes.data ?? []) as AppNotification[],
      count: fallbackRes.count ?? 0,
      page,
      pageSize,
      hasMore: from + (fallbackRes.data?.length ?? 0) < (fallbackRes.count ?? 0),
    };
  }

  handleSupabaseError(error);
  return {
    data: (data ?? []) as AppNotification[],
    count: count ?? 0,
    page,
    pageSize,
    hasMore: from + (data?.length ?? 0) < (count ?? 0),
  };
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
