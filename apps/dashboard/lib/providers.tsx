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

  const [apiKey, setApiKeyState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("artgene_api_key") ?? "";
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
