import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Subscribes to Supabase Realtime changes on a given table and invalidates
 * the matching React Query cache key whenever a row is inserted, updated,
 * or deleted — so screens refetch automatically without manual pull-to-refresh.
 *
 * Usage:
 *   useRealtimeInvalidate('available_today', [QUERY_KEYS.AVAILABLE_TODAY]);
 */
export function useRealtimeInvalidate(table: string, queryKey: readonly unknown[]) {
    const qc = useQueryClient();
    const querySignature = JSON.stringify(queryKey);

    useEffect(() => {
        const stableQueryKey = JSON.parse(querySignature) as unknown[];
        const channelSuffix = Array.from(querySignature).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 0);
        const channel = supabase
            .channel(`${table}-changes-${Math.abs(channelSuffix)}`)
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
    }, [table, querySignature, qc]);
}
