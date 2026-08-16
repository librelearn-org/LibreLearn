import { Outlet, redirect, useLoaderData } from "react-router";
import { authClient } from '~/utils/auth/client'
import { TRPCReactProvider } from '~/utils/trpc/react'

export async function clientLoader() {
    const { data } = await authClient.getSession()
    if (!data?.user) {
        return redirect('/auth/login')
    }
    return data.user
}

export function shouldRevalidate() {
    return false;
}

export default function MyAppLayout() {
    const user = useLoaderData<typeof clientLoader>();
    return (
        <TRPCReactProvider>
            <Outlet context={user} />
        </TRPCReactProvider>
    );
}
