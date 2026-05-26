import { redirect } from "react-router";
import type { Route } from "./+types/userview";
import { caller } from '~/utils/trpc/server.server'
import { useTRPC } from "~/utils/trpc/react";
import { useQuery } from "@tanstack/react-query";
import config from "~/utils/config";


export async function loader(loaderArgs: Route.LoaderArgs) {
    const userId = loaderArgs.params.userId;
    if (!userId) {
        throw new Response("User ID is required", { status: 400 });
        return redirect("/admin/users");
    }
    const api = await caller(loaderArgs);

    const user = await api.admin.getUserProfile(userId);
    if (!user) {
        throw new Response("User not found", { status: 404 });
        return redirect("/admin/users");
    }
    return user
}

export default function Home({ loaderData: userBASE }: Route.ComponentProps) {
    const trpc = useTRPC();

    const { data: user, isLoading, error } = useQuery(trpc.admin.getUserProfile.queryOptions(
        userBASE.id, {
        initialData: userBASE,
        staleTime: config.refetchTime,
        refetchInterval: config.refetchTime,
        refetchIntervalInBackground: config.refetch
    }))
    return (
        <div className="p-3">
            <h1 className="text-2xl font-bold">General</h1>
            name: {user.name} <br />
            mail: {user.email} <br />
            role: {user.role}<br />
            {!user.banned && <p style={{ color: "green" }}>Not banned</p>}
            {user.banned && <p style={{ color: "red" }}>Banned</p>}
            {user.banReason && <p style={{ color: "red" }}>Banned reason: {user.banReason}</p>}
            {user.banExpires && <p style={{ color: "red" }}>Ban expires at: {new Date(user.banExpires).toLocaleString()}</p>}
            id: {user.id}
            {user.accounts.map((account) => (
                <p key={account.id}>
                    sign in with: {account.providerId}
                </p>
            ))}
        </div>
    )
}
