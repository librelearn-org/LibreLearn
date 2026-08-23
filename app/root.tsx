import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import { useEffect } from "react";
import { initI18n } from "./i18n";
import config from "~/utils/config";

import { TRPCReactProvider } from "~/utils/trpc/react";
import type { Route } from "./+types/root";
import "./app.css";
import ui from "beercss";
import { BeerProviders } from "@siemsiem/beerreact";

initI18n();

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap",
  },
];

export async function clientLoader() {
  return {
    lang: config.lang,
    colorScheme: "light" as const
  };
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Librelearn" },
    { name: "description", content: "Librelearn is een opensource alternative voor Studygo." },
    { property: "og:image", content: "https://github.com/librelearn-org/Librelearn/blob/main/public/logos/LiL-VT-LONG-ICON-WITHBG.png?raw=true" },
    { property: "og:title", content: "Librelearn" },
    { property: "og:description", content: "Librelearn is een opensource alternative voor Studygo en andere platforms." },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as { lang: string, colorScheme: "light" | "dark" } | undefined;
  const lang = data?.lang || config.lang;

  useEffect(() => {
    initI18n(lang);
    ui("theme", "#076745");
  }, [lang]);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script data-goatcounter="https://librelearn.goatcounter.com/count"
          async src="//gc.zgo.at/count.js"></script>
        <Meta />
        <Links />
      </head>
      <body className="dark" suppressHydrationWarning>
        <TRPCReactProvider>
          <BeerProviders>
            {children}
          </BeerProviders>
        </TRPCReactProvider>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "Pagina niet gevonden."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main >
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre >
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
