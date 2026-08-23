import { useCallback, useMemo, useEffect } from "react";
import { Outlet, redirect, useLoaderData, useLocation, useNavigate } from "react-router";
import { AutoNavRail, Button, NavBar, useDialog, type navItem } from "@siemsiem/beerreact";
import { authClient } from "~/utils/auth/client";
import { TRPCReactProvider } from "~/utils/trpc/react";
import ui from "beercss";

export async function clientLoader() {
    const { data } = await authClient.getSession();
    if (!data?.user) {
        return redirect("/auth/login");
    }
    return data.user;
}

export function shouldRevalidate() {
    return false;
}

export default function MyAppLayout() {
    const user = useLoaderData<typeof clientLoader>();
    const navigate = useNavigate();
    const location = useLocation();
    const { pushDialog } = useDialog();

    useEffect(() => {
        if (user && (user as any).theme) {
            const themeColor = (user as any).theme.startsWith("#") ? (user as any).theme : `#${(user as any).theme}`;
            ui("theme", themeColor);
        }
    }, [user]);

    const helper = useCallback((v: navItem) => {
        if (v.id === "new-dialog") {
            pushDialog({
                content: (
                    <nav className="vertical no-space">
                        <div className="row center-align">
                            <h4>Nieuw</h4>
                        </div>
                        <Button
                            variant="transparent"
                            size="extra"
                            icon="list"
                            rounding="round"
                            responsive={true}
                            FAB={false}
                            onClick={() => { navigate("/app/lists/edit/new"); }}
                        >
                            Lijst
                        </Button>
                        <Button variant="transparent" size="extra" icon="book" rounding="round" responsive={true} FAB={false}>
                            Boek
                        </Button>
                        <Button variant="transparent" size="extra" icon="group" rounding="round" responsive={true} FAB={false}>
                            Klas
                        </Button>
                    </nav>
                ),
            });
            return;
        }

        if (v.id === "user-profile") {
            pushDialog({
                content: (
                    <nav className="vertical no-space">
                        <div className="row center-align">
                            <h4>Tijdelijk menu</h4>
                        </div>
                        <Button
                            variant="transparent"
                            size="extra"
                            icon="logout"
                            rounding="round"
                            responsive={true}
                            FAB={false}
                            onClick={async () => {
                                await authClient.signOut();
                                navigate("/");
                            }}
                        >
                            Uitloggen
                        </Button>
                    </nav>
                ),
            });
            return;
        }

        navigate(v.id);
    }, [navigate, pushDialog, user]);

    const big = useMemo(() => ({
        id: "new-dialog",
        icon: "add",
        text: "Nieuw",
        onClick: helper
    }), [helper]);

    const mainOptions = useMemo(() => {
        const options: navItem[] = [
            {
                id: "/app",
                icon: "home",
                text: "Home",
                onClick: helper
            },
            {
                id: "/app/lists/mylists",
                icon: "list_alt",
                text: "Mijn lijsten",
                onClick: helper
            },
            {
                id: "/app/testing",
                icon: "experiment",
                text: "Tests",
                onClick: helper
            },
        ];

        if (user?.role === "admin") {
            options.push({
                id: "/admin",
                icon: "admin_panel_settings",
                text: "Admin",
                onClick: helper
            });
        }

        options.push({
            id: "user-profile",
            icon: "account_circle",
            text: user?.name || user?.email || "Gebruiker",
            onClick: helper
        });

        return options;
    }, [helper, user]);

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
    }), [location.pathname, mainOptions]);

    return (
        <TRPCReactProvider>
            <AutoNavRail key={location.pathname} navConfig={navConfig}>
                <main>
                    <Outlet context={user} />
                </main>
                <NavBar {...navConfigBar}></NavBar>
            </AutoNavRail>
        </TRPCReactProvider>
    );
}

