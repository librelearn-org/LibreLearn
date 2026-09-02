export interface AppEnv {
    UI_KLEUR?: string;
    UI_KLEUR_BEWERKBAAR?: boolean | string;
}

declare global {
    interface Window {
        ENV?: AppEnv;
    }
}

export function getDefaultThemeColor(): string {
    const raw = (typeof window !== "undefined" && window.ENV?.UI_KLEUR)
        || (import.meta.env?.UI_KLEUR as string | undefined)
        || (typeof process !== "undefined" ? process.env.UI_KLEUR : undefined)
        || "023824";
    return raw.startsWith("#") ? raw : `#${raw}`;
}

export function isThemeColorEditable(): boolean {
    const val = (typeof window !== "undefined" && window.ENV?.UI_KLEUR_BEWERKBAAR !== undefined)
        ? window.ENV.UI_KLEUR_BEWERKBAAR
        : (import.meta.env?.UI_KLEUR_BEWERKBAAR !== undefined
            ? import.meta.env.UI_KLEUR_BEWERKBAAR
            : (typeof process !== "undefined" ? process.env.UI_KLEUR_BEWERKBAAR : undefined));

    if (val === undefined) {
        return true;
    }
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
        const lower = val.trim().toLowerCase();
        return lower !== "false" && lower !== "0" && lower !== "no";
    }
    return Boolean(val);
}

const config = {
    lang: 'nl',
    getDefaultThemeColor,
    isThemeColorEditable,
} as {
    lang: 'nl' | 'en';
    getDefaultThemeColor: () => string;
    isThemeColorEditable: () => boolean;
};

export default config;

