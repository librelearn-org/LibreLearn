import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "~/server/main";
import { createTRPCContext } from "~/server/trpc";
import { auth } from "~/utils/auth/server.server";
import path from "node:path";
import fs from "node:fs";

const app = new Hono();

const PORT = Number(process.env.PORT || process.env.API_PORT || 5173);

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

function getPublicClientEnv() {
  const rawEditable = process.env.UI_KLEUR_BEWERKBAAR;
  let isEditable = true;
  if (rawEditable !== undefined) {
    const lower = rawEditable.trim().toLowerCase();
    isEditable = lower !== "false" && lower !== "0" && lower !== "no";
  }
  return {
    UI_KLEUR: process.env.UI_KLEUR || "023824",
    UI_KLEUR_BEWERKBAAR: isEditable,
  };
}

function renderIndexHtml() {
  const indexPath = path.resolve(process.cwd(), "build/client/index.html");
  if (!fs.existsSync(indexPath)) return null;

  let html = fs.readFileSync(indexPath, "utf-8");
  const script = `<script id="__LIBRELEARN_ENV__">window.ENV = ${JSON.stringify(getPublicClientEnv())};</script>`;
  if (html.includes('id="__LIBRELEARN_ENV__"')) {
    html = html.replace(/<script id="__LIBRELEARN_ENV__">.*?<\/script>/, script);
  } else {
    html = html.replace("</head>", `${script}</head>`);
  }
  return html;
}

// 3. Serve index.html dynamically on root / index routes to ensure runtime env vars are injected
app.get("/", (c) => {
  const html = renderIndexHtml();
  if (html) return c.html(html);
  return c.text("Build not found. Run 'bun run build' first.", 404);
});
app.get("/index.html", (c) => {
  const html = renderIndexHtml();
  if (html) return c.html(html);
  return c.text("Build not found. Run 'bun run build' first.", 404);
});

// 4. Serve static files from build/client
app.use("/*", serveStatic({ root: "./build/client" }));

// 5. SPA Fallback routing: serve index.html for all non-API GET requests
app.get("*", (c) => {
  const html = renderIndexHtml();
  if (html) return c.html(html);
  return c.text("Build not found. Run 'bun run build' first.", 404);
});

console.log(`Server running on http://localhost:${PORT}`);

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
