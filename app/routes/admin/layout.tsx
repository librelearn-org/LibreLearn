import { useCallback, useMemo } from "react";
import { Outlet, redirect, useLoaderData, useLocation, useNavigate } from "react-router";
import { AutoNavRail, NavBar, type navItem } from "@siemsiem/beerreact";
import { authClient } from "~/utils/auth/client";
import { TRPCReactProvider } from "~/utils/trpc/react";

export async function clientLoader() {
    const { data } = await authClient.getSession();
    if (!data?.user) {
        return redirect("/auth/login");
    }
    if (data.user.role !== "admin") {
        return redirect("/app");
    }
    return data.user;
}

export function shouldRevalidate() {
    return false;
}

export default function AdminLayout() {
    const user = useLoaderData<typeof clientLoader>();
    const navigate = useNavigate();
    const location = useLocation();

    const helper = useCallback((v: navItem) => {
        navigate(v.id);
    }, [navigate]);

    const adminOptions = useMemo(() => [
        {
            id: "/app",
            icon: "arrow_back",
            text: "Terug naar app",
            onClick: helper
        },
        {
            id: "ulist",
            icon: "patient_list",
            text: "Gebruiker lijst",
            onClick: helper
        }
    ], [helper]);

    const navConfig = useMemo(() => ({
        pos: "left" as const,
        InitialMenuOpen: true,
        initialSelected: location.pathname,
        selectedId: location.pathname,
        items: adminOptions,
        bigButton: undefined,
        autoUpdateSelected: true,
        allowSizeChange: false,
    }), [location.pathname, adminOptions]);

    const navConfigBar = useMemo(() => ({
        pos: "bottom" as const,
        initialSelected: location.pathname,
        selectedId: location.pathname,
        items: adminOptions,
        autoUpdateSelected: true,
    }), [location.pathname, adminOptions]);

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
