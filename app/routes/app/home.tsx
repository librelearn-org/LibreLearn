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
                    {(user.role && user.role.includes('admin')) &&
                        <div >
                            <Button onClick={() => {
                                navigate('/admin')
                            }}>

                                Admin
                            </Button>
                        </div>
                    }

                </div>
            </div>

        </div>
    )

}
