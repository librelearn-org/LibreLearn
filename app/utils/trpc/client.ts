import { createTRPCClient, httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";
import type { AppRouter } from "~/server/main";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:5173";
};

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      transformer: SuperJSON,
      url: `${getBaseUrl()}/api/trpc`,
      headers() {
        const headers = new Headers();
        headers.set("x-trpc-source", "client-loader");
        return headers;
      },
    }),
  ],
});
