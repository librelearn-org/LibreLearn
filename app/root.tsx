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
import ui from "beercss";
import { AutoNavRail, BeerProviders, Button, Nav, NavBar, useDialog, type navItem } from "@siemsiem/beerreact";

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

import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { authClient } from "~/utils/auth/client";

function RootContent({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { pushDialog } = useDialog();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const handleDeepLink = async (urlStr: string) => {
        try {
          await Browser.close();
        } catch {}

        try {
          let url: URL;
          if (urlStr.startsWith("org.librelearn.app://")) {
            url = new URL(urlStr.replace("org.librelearn.app://", "https://librelearn.nl/"));
          } else {
            url = new URL(urlStr);
          }

          const token = url.searchParams.get("token");
          if (token) {
            document.cookie = `better-auth.session_token=${token}; path=/; max-age=31536000; Secure; SameSite=Lax`;
            try {
              await authClient.getSession({ query: { disableCookieCache: true } });
            } catch {}
          }

          let pathname = url.pathname;
          if (!pathname || pathname === "/" || pathname === "/auth/callback") {
            pathname = "/app";
          }

          const search = url.search || "";
          const hash = url.hash || "";
          navigate(pathname + search + hash, { replace: true });
        } catch (err) {
          console.error("Failed to process deep link URL:", err);
          navigate("/app", { replace: true });
        }
      };

      CapApp.getLaunchUrl().then((launchUrl) => {
        if (launchUrl?.url) {
          handleDeepLink(launchUrl.url);
        }
      });

      const listenerHandle = CapApp.addListener("appUrlOpen", (event) => {
        handleDeepLink(event.url);
      });

      return () => {
        listenerHandle.then((l) => l.remove());
      };
    }
  }, [navigate]);

  const helper = useCallback((v: navItem) => {
    if (v.id === "new-dialog") {
      pushDialog({
        content: <><nav className="vertical no-space">
          <div className="row center-align">
            <h4>Nieuw</h4>
          </div>
          <Button variant="transparent" size="extra" icon="list" rounding="round" responsive={true} FAB={false} onClick={() => { navigate("/app/lists/edit/new"); }}>Lijst</Button>
          <Button variant="transparent" size="extra" icon="book" rounding="round" responsive={true} FAB={false}>Boek</Button>
          <Button variant="transparent" size="extra" icon="group" rounding="round" responsive={true} FAB={false}>Klas</Button>
        </nav></>,
        // pos: ""
      });
      return;
    } else {
      navigate(v.id);
    }
  }, [navigate, pushDialog]);

  const big = useMemo(() => ({
    id: "new-dialog",
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
      id: "/app/lists/mylists",
      icon: "chat_bubble",
      text: "Mijn lijsten",
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
  const navConfigBar = useMemo(() => ({
    pos: "bottom" as const,
    initialSelected: location.pathname,
    selectedId: location.pathname,
    items: mainOptions,
    autoUpdateSelected: true,
  }), [location.pathname, mainOptions, big]);

  return (
    <AutoNavRail key={location.pathname} navConfig={navConfig}>
      <main>
        {children}
      </main>
      <NavBar {...navConfigBar}></NavBar>
    </AutoNavRail>
  );
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
            <RootContent>{children}</RootContent>
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
