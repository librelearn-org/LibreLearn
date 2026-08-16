import { createTRPCClient, httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";
import type { AppRouter } from "~/server/main";

import { Capacitor } from "@capacitor/core";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    if (Capacitor.isNativePlatform()) {
      return "https://librelearn.nl";
    }
    return window.location.origin;
  }
  return process.env.NODE_ENV === "production" ? "https://librelearn.nl" : "http://localhost:5173";
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
