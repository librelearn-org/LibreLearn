import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "~/server/main";
import { createTRPCContext } from "~/server/trpc";
import { auth } from "~/utils/auth/server.server";
import { handleNativeCallback } from "~/utils/auth/native-callback.server";
import path from "node:path";
import fs from "node:fs";

const app = new Hono();

const PORT = Number(process.env.PORT || process.env.API_PORT || 5173);

// 0. Native OAuth callback handler
app.get("/api/native-callback", async (c) => {
  return handleNativeCallback(c.req.raw);
});

// 1. Better Auth endpoint handler
app.all("/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// 2. tRPC endpoint handler
app.all("/api/trpc/*", (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        headers: c.req.raw.headers,
      }),
  });
});

// 3. Serve static files from build/client
app.use("/*", serveStatic({ root: "./build/client" }));

// 4. SPA Fallback routing: serve index.html for all non-API GET requests
app.get("*", (c) => {
  const indexPath = path.resolve(process.cwd(), "build/client/index.html");
  if (fs.existsSync(indexPath)) {
    return c.html(fs.readFileSync(indexPath, "utf-8"));
  }
  return c.text("Build not found. Run 'bun run build' first.", 404);
});

console.log(`🚀 LibreLearn Server (API + SPA Host) running on http://localhost:${PORT}`);

declare const Bun: any;

if (typeof Bun !== "undefined") {
  Bun.serve({
    fetch: app.fetch,
    port: PORT,
  });
} else {
  serve({
    fetch: app.fetch,
    port: PORT,
  });
}
