import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { Button, Card, classNames, Input, Space, useDialog, useToast } from "@siemsiem/beerreact";
import ui from "beercss";
import { authClient } from "~/utils/auth/client";
import { trpcClient } from "~/utils/trpc/client";
import config from "~/utils/config";

export default function Profile() {
    const user = useOutletContext<any>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { pushDialog, closeDialog } = useDialog();
    const { t } = useTranslation();
    const firstNameRef = useRef<HTMLInputElement>(null);
    const lastNameRef = useRef<HTMLInputElement>(null);
    const themeEditPriv = useMemo(() => {
        console.log(config.isThemeColorEditable())
        console.log(config.getDefaultThemeColor())
        return config.isThemeColorEditable()
    }, [])

    const [currentFirstName, ...currentLastNameParts] = user?.name?.split(" ") ?? [];

    const formatColor = (c?: string) => {
        if (!c) return config.getDefaultThemeColor();
        return c.startsWith("#") ? c : `#${c}`;
    };


    const [themeColor, setThemeColor] = useState<string>(() => formatColor(user?.theme));

    useEffect(() => {
        const fetchUserTheme = async () => {
            if (!config.isThemeColorEditable()) {
                return false
            }
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

    const handleThemeLearnMore = useCallback(() => {
        pushDialog({
            content: (
                <nav className="vertical no-space">
                    <div className="row center-align">
                        <h4>{t("profile:themeColor")}</h4>
                    </div>
                    <Space />
                    <p>{t("profile:themeLearnText")}</p>
                    <nav className="right-align">
                        <Button onClick={closeDialog}>Oke!</Button>
                    </nav>
                </nav>
            ),
        });
    }, [pushDialog, closeDialog, t]);

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setThemeColor(newColor);
        ui("theme", newColor);
    };

    const handleSaveProfile = useCallback(async (button: HTMLButtonElement) => {
        if (button.disabled) return;

        button.disabled = true;
        try {
            const firstName = firstNameRef.current?.value.trim() ?? "";
            const lastName = lastNameRef.current?.value.trim() ?? "";
            const { error } = await authClient.updateUser({ name: `${firstName} ${lastName}`.trim() });
            try {
                await trpcClient.user.updateTheme.mutate({ theme: themeColor });
            } catch (err) {
                console.error("Failed to update theme in userdata:", err);
            }
            if (error) {
                addToast({ text: error.message || t("auth:errors.unknown"), type: "error" });
            } else {
                addToast({ text: "Gelukt!" });
            }
        } finally {
            button.disabled = false;
        }
    }, [addToast, t, themeColor]);

    return (
        <Card className="large-width absolute center middle">
            <nav className="vertical no-space">
                <div className="row center-align">
                    <h4>{t("profile:title")}</h4>
                </div>
                <Space />
                <label style={{ fontWeight: "bold" }}>
                    {t("profile:fullName")}
                </label>
                <Space />
                <div className="grid">
                    <div className="s6">
                        <Input
                            type="text"
                            label={t("profile:name")}
                            defaultValue={currentFirstName ?? ""}
                            ref={firstNameRef}
                        />
                    </div>
                    <div className="s6">
                        <Input
                            type="text"
                            label={t("profile:lastName")}
                            defaultValue={currentLastNameParts.join(" ")}
                            ref={lastNameRef}
                        />
                    </div>
                </div>
                <Space />
                {themeEditPriv ? <>
                    <label htmlFor="theme-color-input" className={classNames.text.bold}>
                        {t("profile:themeColor")}
                    </label>
                    <Space />
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <div
                            style={{
                                position: "relative",
                                width: "48px",
                                height: "48px",
                                borderRadius: "50%",
                                backgroundColor: themeColor,
                                cursor: "pointer"
                            }}
                        >
                            <input
                                id="theme-color-input"
                                type="color"
                                value={themeColor}
                                onChange={handleColorChange}
                                style={{ cursor: "pointer" }}
                            />
                        </div>
                        <Button
                            variant="transparent"
                            onClick={() => {
                                const defaultColor = config.getDefaultThemeColor();;
                                setThemeColor(defaultColor);
                                ui("theme", defaultColor);
                            }}
                        >
                            {t("profile:resetTheme")}
                        </Button>
                    </div>
                    <a
                        className={"secondary-text underline" + classNames.text.size.small}
                        onClick={handleThemeLearnMore}
                    >
                        {t("profile:themeLearn")}
                    </a>
                </> : <p className={"red"}>Je mag niet je themakleur wijzigen.</p>}
                <Space />
                <Button
                    icon="save"
                    size="large"
                    rounding="round"
                    responsive={true}
                    onClick={(e) => handleSaveProfile(e.currentTarget)}
                >
                    {t("profile:save")}
                </Button>
                <Space />
                <Button
                    variant="transparent"
                    size="large"
                    icon="logout"
                    rounding="round"
                    responsive={true}
                    FAB={false}
                    onClick={async () => {
                        await authClient.signOut();
                        navigate("/");
                    }}
                >
                    {t("profile:logout")}
                </Button>
            </nav>
        </Card>
    );
}
