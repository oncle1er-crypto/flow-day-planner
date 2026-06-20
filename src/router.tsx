import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { routeTree } from "./routeTree.gen";
import { idbStorage } from "./lib/offline-db";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep cached data fresh enough for offline reuse, but still revalidate.
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
        staleTime: 1000 * 30,
        retry: (failureCount, error) => {
          // Don't retry when offline; the queue handles writes and reads will refetch later.
          if (typeof navigator !== "undefined" && !navigator.onLine) return false;
          return failureCount < 2;
        },
      },
    },
  });

  // Persist React Query cache to IndexedDB so reads work without network.
  if (typeof window !== "undefined") {
    const persister = createAsyncStoragePersister({
      storage: idbStorage,
      key: "smart-daily-rq-cache",
      throttleTime: 1000,
    });
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      buster: "v1",
    });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
