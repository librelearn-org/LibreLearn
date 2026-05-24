// TODO: dit maken!!
import { redirect } from "react-router";
import type { Route } from "./+types/userview";
import { caller } from '~/utils/trpc/server.server'


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

export default function Home({ loaderData: user }: Route.ComponentProps) {

    return (
        <div>
            <h1>{user.name}</h1>
            User data:
            mail: {user.email}
            role: {user.role}
            {user.banned && <p style={{ color: "red" }}>Banned</p>}
            {user.forumBanned && <p style={{ color: "red" }}>Forum banned</p>}
            {user.banReason && <p style={{ color: "red" }}>Banned reason: {user.banReason}</p>}
            {user.banExpires && <p style={{ color: "red" }}>Ban expires at: {new Date(user.banExpires).toLocaleString()}</p>}
            id: {user.id}
            {user.accounts.map((account) => (
                <p key={account.id}>
                    sign in with: {JSON.stringify(account)}
                </p>
            ))}

            <h1>Forum</h1>

            {user.forumBanned}
        </div>
    )
}
