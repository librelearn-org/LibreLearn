import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '~/utils/prisma'
import { admin, genericOAuth, organization } from "better-auth/plugins"

const getFirstName = (name?: string | null) => {
    const firstName = name?.trim().split(/\s+/)[0]

    return firstName || undefined
}

export const auth = betterAuth({
    appName: "Librelearn",
    secret: process.env.AUTH_SECRET,

    emailAndPassword: {
        enabled: false, // voor nu. 
        requireEmailVerification: !!process.env.SMTP_HOST,
    },
    advanced: {
        database: {
            generateId: () => {
                return crypto.randomUUID()
            }
        }
    },
    socialProviders: {
    },
    plugins: [
        genericOAuth({
            config: [
                ...(process.env.HACKCLUBAUTH_CLIENT_ID && process.env.HACKCLUBAUTH_CLIENT_SECRET) ? [{
                    providerId: "Hackclub",
                    discoveryUrl: "https://auth.hackclub.com/.well-known/openid-configuration",
                    clientId: process.env.HACKCLUBAUTH_CLIENT_ID || "",
                    clientSecret: process.env.HACKCLUBAUTH_CLIENT_SECRET || "",
                    scopes: ["openid", "email", "profile"],
                    mapProfileToUser: (profile: Record<string, any>) => ({
                        name: getFirstName(profile.name ?? profile.given_name ?? profile.family_name),
                    }),
                }] : []
            ],
        }),
        admin(),
    ],
    baseURL: process.env.APP_BASE || 'http://localhost:5173',
    database: prismaAdapter(prisma, {
        provider: 'postgresql'
    }) 
})
