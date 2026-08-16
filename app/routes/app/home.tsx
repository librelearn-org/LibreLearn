import { useNavigate, useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@siemsiem/beerreact";

export default function Home() {
    const user = useOutletContext<any>();
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
