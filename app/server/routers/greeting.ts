import type { TRPCRouterRecord } from '@trpc/server'
import { TRPCError } from '@trpc/server'
import { send } from 'vite'
import { z } from 'zod'
import { protectedProcedure, publicProcedure, veryProtectedProcedure } from '~/server/trpc'
import { sendMessageToDiscord } from '~/utils/discord.server'

export const greetingRouter = {
    hello: publicProcedure.query(async ({ ctx }) => {
        return 'hello world'
    }),
    user: protectedProcedure.query(async ({ input, ctx }) => {
        const user = await ctx.prisma.user.findFirst({
            where: {
                id: ctx.user?.id
            }
        })

        return user
    }),
    checkSession: protectedProcedure.query(async ({ ctx }) => {
        return ctx.user
    }),
    adminLog: veryProtectedProcedure
        .input(
            z.object({
                message: z.string().min(1).max(1000)
            })
        )
        .mutation(async ({ input, ctx }) => {

            sendMessageToDiscord({
                title: 'Admin Log',
                description: input.message,
                color: 0x800080, // purple
                timestamp: new Date().toISOString(),
                author: {
                    name: ctx.user.name
                },
            })
            return { success: true, message: 'Logged successfully' }
        }),
    setConfig: veryProtectedProcedure
        .input(
            z.object({
                key: z.string(),
                value: z.boolean()
            })
        )
        .mutation(async ({ input, ctx }) => {

            sendMessageToDiscord({
                title: 'Config Changed: ' + input.key,
                description: 'config key ' + input.key + ' was set to ' + input.value + ' by ' + ctx.user.name,
                timestamp: new Date().toISOString(),
                color: 0xFFA500, // orange
                author: {
                    name: ctx.user.name
                },
            })
            await ctx.prisma.config.upsert({
                where: {
                    key: input.key
                },
                update: {
                    value: input.value
                },
                create: {
                    key: input.key,
                    value: input.value
                }
            })
            return { success: true }
        }),
    getConfig: veryProtectedProcedure
        .input(
            z.object({
                key: z.optional(z.string())
            })
        )
        .query(async ({ input, ctx }) => {
            if (input.key) {
                const config = await ctx.prisma.config.findUnique({
                    where: {
                        key: input.key
                    }
                })
                return config
            } else {
                const configs = await ctx.prisma.config.findMany({
                    where: {
                        isConfig: true
                    }
                })
                return configs
            }

        })

} satisfies TRPCRouterRecord
