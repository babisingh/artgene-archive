"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

/**
 * The one provider the app needs: react-query's cache.
 *
 * This also used to hold an API-key context, which handed every page a typed
 * client for the TINSEL certificate API. Both are gone: nothing consumed the
 * context, and the client had no caller left once /sequences stopped being a
 * certificate registry. The pages that read the archive today use
 * lib/catalogue.ts, which goes through the Next proxy and needs no key at all,
 * and the one page that does need an operator's key — /review — holds it in
 * sessionStorage itself, for the life of its tab.
 */

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

// One client for the life of the tab, so a navigation does not throw the cache
// away. On the server each render gets its own, because a cache shared there
// would be shared between visitors.
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
