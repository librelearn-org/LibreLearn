import type { Route } from "./+types/home";
import { authClient } from "~/utils/auth/client"
import { redirect, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@siemsiem/beerreact";

export async function clientLoader() {
    const { data } = await authClient.getSession()
    if (!data?.user) {
        return redirect('/auth/login')
    }
    return data.user
}

export default function Home({ loaderData: user }: Route.ComponentProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    return (
        <div >
            <div >
                <div >
                    <h1 >{t("startPage:welcome")}</h1>
                    <p >{t("startPage:description")}</p>
                    <details>
                        <summary>Meer info</summary>
                        <p>{JSON.stringify(user)}</p>
                    </details>

                </div>
            </div>

        </div>
    )

}
