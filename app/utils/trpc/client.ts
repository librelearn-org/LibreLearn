import { createTRPCClient, httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";
import type { AppRouter } from "~/server/main";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.protocol === "capacitor:" || window.location.protocol === "file:") {
      return "https://librelearn.nl";
    }
    return window.location.origin;
  }
  return "https://librelearn.nl";
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
