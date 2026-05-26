import { Outlet, useNavigate } from "react-router";
import { Navbar } from "~/components/navbar/navbar";
import { auth } from '~/utils/auth/server.server'
import { redirect } from "react-router";
import type { Route } from "./+types/layout";
import { caller } from '~/utils/trpc/server.server'
import './admin.css'
import { Button } from "~/components/button/button";
import { ArrowBigLeftIcon } from "lucide-react";

export async function action(actionArgs: Route.ActionArgs) {
    const headers = new Headers(actionArgs.request.headers)
    const result = await auth.api.getSession({ headers })
    const user = result?.user
    if (!user) {
        return redirect('/auth/login')
    }
    if (!user.role || !user.role.includes('admin')) {
        return redirect('/nee')
    }

    const formData = await actionArgs.request.formData()
    const key = formData.get('key')
    if (typeof key !== 'string' || key.length === 0) {
        return new Response('Invalid config key', { status: 400 })
    }

    const value = formData.get('value') === 'true'
    const api = await caller(actionArgs)
    await api.user.setConfig({ key, value })

    return redirect('/admin')
}

export async function loader(loaderArgs: Route.LoaderArgs) {
    const headers = new Headers(loaderArgs.request.headers)
    const result = await auth.api.getSession({ headers })
    const user = result?.user
    if (!user) {
        return redirect('/auth/login')
    }
    if (!user.role) {
        return redirect('/nee')
    }
    if (!user.role.includes('admin')) {
        return redirect('/nee')
    }
    const api = await caller(loaderArgs)
    try {
        await api.user.checkSession()
    } catch (e) {
        return redirect('/auth/login')
    }
    return user
}


export default function MyAppLayout() {
    const navigate = useNavigate();

    return (
        <div className="admin-layout bg-admin-900 min-h-screen relative">
            <Navbar knoppen={[
                {
                    title: 'Admin',
                    linkTo: '/admin'
                },
                {
                    title: "Users",
                    linkTo: '/admin/users'
                },
                {
                    title: "test helper",
                    linkTo: '/admin/test'
                },
            ]} />
            <div className="absolute bottom-4 left-4" >
                <Button onClick={() => navigate('/app')}>
                    <ArrowBigLeftIcon /> Platform
                </Button>
            </div>
            <Outlet />
        </div>
    );
}
