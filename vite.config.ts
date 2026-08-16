import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

function devApiPlugin(): Plugin {
  return {
    name: "dev-api-server",
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url) return next();

        // Prevent React Router from throwing route mismatch errors for Service Worker in dev
        if (req.url === "/sw.js" || req.url.startsWith("/sw.js")) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/javascript");
          res.end("// Service worker not active in dev mode");
          return;
        }

        if (req.url.startsWith("/api/native-callback") || req.url.startsWith("/api/auth") || req.url.startsWith("/api/trpc")) {
          try {
            const { auth } = await server.ssrLoadModule("./app/utils/auth/server.server.ts");
            const { handleNativeCallback } = await server.ssrLoadModule("./app/utils/auth/native-callback.server.ts");
            const { appRouter } = await server.ssrLoadModule("./app/server/main.ts");
            const { createTRPCContext } = await server.ssrLoadModule("./app/server/trpc.ts");
            const { fetchRequestHandler } = await import("@trpc/server/adapters/fetch");

            const protocol = req.socket?.encrypted ? "https" : "http";
            const host = req.headers.host || "localhost:5173";
            const fullUrl = new URL(req.url, `${protocol}://${host}`);

            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
              if (Array.isArray(value)) {
                for (const v of value) headers.append(key, v);
              } else if (value) {
                headers.set(key, value as string);
              }
            }

            let body: any = null;
            if (req.method !== "GET" && req.method !== "HEAD") {
              const buffers: Buffer[] = [];
              for await (const chunk of req) {
                buffers.push(Buffer.from(chunk));
              }
              body = Buffer.concat(buffers);
            }

            const webReq = new Request(fullUrl.toString(), {
              method: req.method,
              headers,
              body,
            });

            let webRes: Response;
            if (req.url.startsWith("/api/native-callback")) {
              webRes = await handleNativeCallback(webReq);
            } else if (req.url.startsWith("/api/auth")) {
              webRes = await auth.handler(webReq);
            } else {
              webRes = await fetchRequestHandler({
                endpoint: "/api/trpc",
                req: webReq,
                router: appRouter,
                createContext: () => createTRPCContext({ headers: webReq.headers }),
              });
            }

            res.statusCode = webRes.status;
            webRes.headers.forEach((val: string, key: string) => {
              res.setHeader(key, val);
            });

            const responseBuffer = await webRes.arrayBuffer();
            res.end(Buffer.from(responseBuffer));
            return;
          } catch (err) {
            console.error("API Dev Error:", err);
            res.statusCode = 500;
            res.end("Internal API Error");
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  optimizeDeps: {
    exclude: ["fsevents", "lightningcss"],
  },
  ssr: {
    noExternal: ["beercss", "@siemsiem/beerreact"],
  },
  plugins: [devApiPlugin(), reactRouter(), tsconfigPaths()],
});
