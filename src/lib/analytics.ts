import { supabase } from '@/lib/supabase';

export async function logAnalyticsEvent(eventName: string, metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('analytics_events').insert({
      user_id: user?.id ?? null,
      event_name: eventName,
      metadata,
    });
  } catch {
    // Non-blocking telemetry
  }
}
