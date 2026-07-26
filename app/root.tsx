import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from "react-router";
import { useCallback, useEffect, useMemo } from "react";
import { initI18n } from "./i18n";
import config from "~/utils/config";

import { TRPCReactProvider } from "~/utils/trpc/react";
import type { Route } from "./+types/root";
import "./app.css";
import "beercss";
import { AutoNavRail, BeerProviders, Nav, useDialog, type navItem } from "@siemsiem/beerreact";

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
    { name: "description", content: "Librelearn is een opensource alternative voor WRTS." },
    { property: "og:image", content: "https://github.com/librelearn-org/LibreLearn/blob/main/public/logos/LiL-VT-LONG-ICON-WITHBG.png?raw=true" },
    { property: "og:title", content: "Librelearn" },
    { property: "og:description", content: "Librelearn is een opensource alternative voor WRTS en andere platforms." },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as { lang: string, colorScheme: "light" | "dark" } | undefined;
  const lang = data?.lang || config.lang;
  const navigate = useNavigate();
  const location = useLocation();
  const { pushDialog } = useDialog()

  useEffect(() => {
    initI18n(lang);
  }, [lang]);

  const helper = useCallback((v: navItem) => {
    navigate(v.id);
  }, [navigate]);

  const big = useMemo(() => ({
    id: "/app/new",
    icon: "add",
    text: "Nieuw",
    onClick: helper
  }), [helper]);

  const mainOptions = useMemo(() => [
    {
      id: "/app",
      icon: "home",
      text: "Home",
      onClick: helper
    },
    {
      id: "/app/dialogs",
      icon: "chat_bubble",
      text: "dialogs and toasts",
      onClick: helper
    },
    {
      id: "/app/testing",
      icon: "experiment",
      text: "Tests",
      onClick: helper
    }
  ], [helper]);

  const navConfig = useMemo(() => ({
    pos: "left" as const,
    InitialMenuOpen: true,

    initialSelected: location.pathname,
    selectedId: location.pathname,
    items: mainOptions,
    bigButton: big,
    autoUpdateSelected: true,
    allowSizeChange: false,
  }), [location.pathname, mainOptions, big]);

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
        <AutoNavRail key={location.pathname} navConfig={navConfig} >
          <main>
            {children}
          </main>
        </AutoNavRail>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <TRPCReactProvider>
      <BeerProviders>
        <Outlet />
      </BeerProviders>
    </TRPCReactProvider>
  );
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
