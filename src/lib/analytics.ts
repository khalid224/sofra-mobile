import { supabase } from '@/lib/supabase';

export async function logAnalyticsEvent(eventName: string, metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    await supabase.rpc('log_analytics_event', {
      p_event_name: eventName,
      p_metadata: metadata,
    });
  } catch {
    // Non-blocking telemetry
  }
}
