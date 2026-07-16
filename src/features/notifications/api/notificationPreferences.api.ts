import { supabase } from '@/lib/supabase';
import type { NotificationPreferences, UUID } from '@/types';

export async function fetchNotificationPreferences(
  userId: UUID,
): Promise<NotificationPreferences | null> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data as NotificationPreferences | null;
}

export async function upsertNotificationPreferences(
  userId: UUID,
  prefs: Partial<Omit<NotificationPreferences, 'user_id' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}
