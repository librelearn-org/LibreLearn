import { createAuthClient } from "better-auth/client"
import { adminClient, genericOAuthClient } from "better-auth/client/plugins"
import { Capacitor } from "@capacitor/core"

const getAuthBaseUrl = () => {
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
        return "https://librelearn.nl"
    }
    return undefined
}

const nativeBaseUrl = getAuthBaseUrl()

export const authClient = createAuthClient({
    ...(nativeBaseUrl ? { baseURL: nativeBaseUrl } : {}),
    plugins: [
        genericOAuthClient(),
        adminClient(),
    ],
})