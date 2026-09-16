import SuperJSON from "superjson";

import { useRef, useState, type ReactNode } from "react";
import {
  QueryClientProvider,
  QueryClient,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useToast } from "@siemsiem/beerreact";

import type { AppRouter } from "~/server/main";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { getErrorMessage } from "~/utils/error-message";

function makeQueryClient(onError: (message: string) => void) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => onError(getErrorMessage(error)),
    }),
    mutationCache: new MutationCache({
      onError: (error) => onError(getErrorMessage(error)),
    }),
  });
}
let browserQueryClient: QueryClient | undefined = undefined;
function getQueryClient(onError: (message: string) => void) {
  if (typeof window === "undefined") {
    return makeQueryClient(onError);
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient(onError);
    return browserQueryClient;
  }
}

const getBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  if (typeof process !== "undefined" && process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`;
  if (typeof process !== "undefined" && process.env.PORT)
    return `http://localhost:${process.env.PORT}`;
  return `http://localhost:3000`;
};

const links = [
  loggerLink({
    enabled: (op) =>
      (typeof process !== "undefined" &&
        process.env.NODE_ENV === "development") ||
      (op.direction === "down" && op.result instanceof Error),
  }),
  httpBatchLink({
    transformer: SuperJSON,
    url: getBaseUrl() + "/api/trpc",
    headers() {
      const headers = new Headers();
      headers.set("x-trpc-source", "react");
      return headers;
    },
  }),
];

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const { addToast } = useToast();
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

  const [queryClient] = useState(() =>
    getQueryClient((message) =>
      addToastRef.current({ text: message, type: "error" }),
    ),
  );
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links,
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
