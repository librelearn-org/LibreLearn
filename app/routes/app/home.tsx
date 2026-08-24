import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { Button, Card, Flex, Nav } from "@siemsiem/beerreact";
import ui from "beercss";
import { trpcClient } from "~/utils/trpc/client";

import { Logo } from "~/components/Logo";

export default function Home() {
    const user = useOutletContext<any>();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const formatColor = (c?: string) => {
        if (!c) return "#076745";
        return c.startsWith("#") ? c : `#${c}`;
    };

    const [themeColor, setThemeColor] = useState<string>(() => formatColor(user?.theme));

    useEffect(() => {
        const fetchUserTheme = async () => {
            try {
                const userData = await trpcClient.user.user.query();
                if (userData?.theme) {
                    const formatted = formatColor(userData.theme);
                    setThemeColor(formatted);
                    ui("theme", formatted);
                } else if (user?.theme) {
                    const formatted = formatColor(user.theme);
                    ui("theme", formatted);
                }
            } catch {
                if (user?.theme) {
                    const formatted = formatColor(user.theme);
                    ui("theme", formatted);
                }
            }
        };
        fetchUserTheme();
    }, [user?.theme]);

    const handleColorChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setThemeColor(newColor);
        ui("theme", newColor);
        try {
            await trpcClient.user.updateTheme.mutate({ theme: newColor });
        } catch (err) {
            console.error("Failed to update theme in userdata:", err);
        }
    };

    return (
        <div>
            <div>
                <div>
                    <h1>{t("startPage:welcome")} <Logo style={{ height: "1em", margin: "0", padding: "-10em" }} /></h1>

                    <p>{t("startPage:description")}</p>

                    <Card>
                        <label htmlFor="theme-color-input" style={{ fontWeight: "bold" }}>
                            {t("startPage:themeColor", { defaultValue: "Thema kleur" })}
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
                            <input
                                id="theme-color-input"
                                type="color"
                                value={themeColor}
                                onChange={handleColorChange}
                                style={{
                                    width: "50px",
                                    height: "40px",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    padding: "2px"
                                }}
                            />
                            <code>{themeColor}</code>
                        </div>
                        <Button onClick={async () => {
                            const defaultColor = "#023824";
                            setThemeColor(defaultColor);
                            ui("theme", defaultColor);
                            try {
                                await trpcClient.user.updateTheme.mutate({ theme: defaultColor });
                            } catch (err) {
                                console.error("Failed to update theme in userdata:", err);
                            }
                        }}>Reset</Button>
                    </Card>


                    <details style={{ marginTop: "1.5rem" }}>
                        <summary>Meer info</summary>
                        <p>{JSON.stringify(user)}</p>
                    </details>
                </div>
            </div>
        </div>
    );
}
