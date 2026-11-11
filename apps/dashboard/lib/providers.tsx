"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createApiClient, type ApiClient } from "./api";

// ---------------------------------------------------------------------------
// API key context — stored in sessionStorage, never in a cookie or URL
// ---------------------------------------------------------------------------

interface ApiKeyContextValue {
  apiKey: string;
  setApiKey: (key: string) => void;
  client: ApiClient;
}

const ApiKeyContext = createContext<ApiKeyContextValue | null>(null);

export function useApiKey(): ApiKeyContextValue {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error("useApiKey must be used inside Providers");
  return ctx;
}

// ---------------------------------------------------------------------------
// Providers wrapper
// ---------------------------------------------------------------------------

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

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  // SECURITY: never read the key from a NEXT_PUBLIC_* variable. Next inlines
  // those into the client bundle at build time, so the key would be readable by
  // anyone who views source, which is worse than a cookie. The key lives in
  // sessionStorage only, put there by an operator for the duration of a tab.
  // Public pages need no key: the server-side proxy supplies a read-only one
  // for the allowlisted public GET paths.
  const [apiKey, setApiKeyState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem("artgene_api_key") ?? "";
    } catch {
      return "";
    }
  });

  function setApiKey(key: string) {
    setApiKeyState(key);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("artgene_api_key", key);
    }
  }

  const client = createApiClient(apiKey);

  return (
    <QueryClientProvider client={queryClient}>
      <ApiKeyContext.Provider value={{ apiKey, setApiKey, client }}>
        {children}
      </ApiKeyContext.Provider>
    </QueryClientProvider>
  );
}
