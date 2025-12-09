import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type TableName = 'empresas' | 'profiles' | 'user_roles' | 'lotes_mensais' | 'colaboradores' | 'colaboradores_lote' | 'obras' | 'notas_fiscais' | 'apolices';

interface UseRealtimeSubscriptionOptions {
  table: TableName;
  queryKeys: string[];
  filter?: string;
}

export function useRealtimeSubscription({ table, queryKeys, filter }: UseRealtimeSubscriptionOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channelConfig: any = {
      event: '*',
      schema: 'public',
      table: table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(`realtime-${table}-${queryKeys.join('-')}`)
      .on('postgres_changes', channelConfig, () => {
        // Invalidate all related queries when data changes
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, queryKeys, filter, queryClient]);
}

// Hook for multiple tables
export function useMultipleRealtimeSubscriptions(subscriptions: UseRealtimeSubscriptionOptions[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels = subscriptions.map((sub, index) => {
      const channelConfig: any = {
        event: '*',
        schema: 'public',
        table: sub.table,
      };

      if (sub.filter) {
        channelConfig.filter = sub.filter;
      }

      return supabase
        .channel(`realtime-multi-${sub.table}-${index}`)
        .on('postgres_changes', channelConfig, () => {
          sub.queryKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        })
        .subscribe();
    });

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [subscriptions, queryClient]);
}
