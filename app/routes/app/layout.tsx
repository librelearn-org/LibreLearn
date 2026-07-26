import { Outlet, redirect } from "react-router";
import { authClient } from '~/utils/auth/client'
import { TRPCReactProvider } from '~/utils/trpc/react'

export async function clientLoader() {
    const { data } = await authClient.getSession()
    if (!data?.user) {
        return redirect('/auth/login')
    }
    return data.user
}


export default function MyAppLayout() {
    return (
        <>
            <TRPCReactProvider>
                <Outlet />
            </TRPCReactProvider>
        </>
    );
}
