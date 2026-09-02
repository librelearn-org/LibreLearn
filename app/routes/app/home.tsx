import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "~/components/Logo";

export default function Home() {
    const user = useOutletContext<any>();
    const { t } = useTranslation();

    return (
        <div>
            <div>
                <div>
                    <h1>{t("startPage:welcome")} <Logo style={{ height: "1em", margin: "0", padding: "-10em" }} /></h1>

                    <p>{t("startPage:description")}</p>

                    <details style={{ marginTop: "1.5rem" }}>
                        <summary>Meer info</summary>
                        <p>{JSON.stringify(user)}</p>
                    </details>
                </div>
            </div>
        </div>
    );
}
