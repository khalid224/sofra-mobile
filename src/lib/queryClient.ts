import { QueryClient } from '@tanstack/react-query';
import { mapError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
    mutations: {
      onError: (error) => {
        console.error('[Mutation Error]', mapError(error));
      },
    },
  },
});
