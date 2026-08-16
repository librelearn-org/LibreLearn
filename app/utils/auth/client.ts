import { createAuthClient } from "better-auth/client"
import { adminClient, genericOAuthClient, organizationClient, usernameClient } from "better-auth/client/plugins"

const getAuthBaseUrl = () => {
    if (typeof window !== "undefined") {
        if (window.location.hostname === "localhost" || window.location.protocol === "capacitor:" || window.location.protocol === "file:") {
            return "https://librelearn.nl"
        }
        return window.location.origin
    }
    return "https://librelearn.nl"
}

export const authClient = createAuthClient({
    baseURL: getAuthBaseUrl(),
    plugins: [
        genericOAuthClient(),
        adminClient(),
    ],
})