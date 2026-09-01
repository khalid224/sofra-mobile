import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

let realtimeSubscriptionId = 0;

/**
 * Subscribes to Supabase Realtime changes on a given table and invalidates
 * the matching React Query cache key whenever a row is inserted, updated,
 * or deleted — so screens refetch automatically without manual pull-to-refresh.
 *
 * Usage:
 *   useRealtimeInvalidate('available_today', [QUERY_KEYS.AVAILABLE_TODAY]);
 */
export function useRealtimeInvalidate(table: string, queryKey: readonly unknown[], enabled = true) {
    const qc = useQueryClient();
    const querySignature = JSON.stringify(queryKey);

    useEffect(() => {
        if (!enabled) return undefined;
        const stableQueryKey = JSON.parse(querySignature) as unknown[];
        realtimeSubscriptionId += 1;
        const channel = supabase
            // Tab screens remain mounted while navigating. A unique channel
            // name prevents Supabase from reusing an already subscribed
            // channel and rejecting the next postgres_changes callback.
            .channel(`${table}-changes-${realtimeSubscriptionId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                () => {
                    qc.invalidateQueries({ queryKey: stableQueryKey });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [enabled, table, querySignature, qc]);
}
