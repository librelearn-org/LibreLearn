import superjson from 'superjson'

import { ZodError } from 'zod'
import { initTRPC, TRPCError } from '@trpc/server'

import { prisma } from '~/utils/prisma'
import { auth } from '~/utils/auth/server.server'

// Create the tRPC context, which includes the database client and the potentially authenticated user. This will provide convenient access to both within our tRPC procedures.
export const createTRPCContext = async (opts: { headers: Headers }) => {
    const authSession = await auth.api.getSession({
        headers: opts.headers
    })

    const source = opts.headers.get('x-trpc-source') ?? 'unknown'
    console.log('>>> tRPC Request from', source, 'by', authSession?.user.email)

    return {
        prisma,
        user: authSession?.user
    }
}
type Context = Awaited<ReturnType<typeof createTRPCContext>>

// Initialize tRPC with the context we just created and the SuperJSON transformer.
const t = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => ({
        ...shape,
        data: {
            ...shape.data,
            zodError: error.cause instanceof ZodError ? error.cause.flatten() : null
        }
    })
})

// Create a caller factory for making server-side tRPC calls from loaders or actions.
export const createCallerFactory = t.createCallerFactory

// Utility for creating a tRPC router
export const createTRPCRouter = t.router

const withResolvedUser = t.middleware(async ({ ctx, next, path }) => {
    if (!ctx.user?.id) {
        return next()
    }

    const dbUser = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            banned: true,
            forumBanned: true
        }
    })

    if (!dbUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    if (dbUser.role == "admin") {
        return next({
            ctx: {
                user: dbUser
            }
        })
    }

    if (dbUser.banned) {
        throw new TRPCError({ code: 'FORBIDDEN' })
    }

    return next({
        ctx: {
            user: dbUser
        }
    })
})

// Utility for a public procedure (doesn't require an autheticated user)
export const publicProcedure = t.procedure.use(withResolvedUser)

export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
    if (!ctx.user?.id) {
        // we vangen dit op in de client en sturen de user naar de login pagina
        throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    return next({
        ctx: {
            user: ctx.user
        }
    })
})
// een admin only procedure
export const veryProtectedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this resource' })
    }

    return next({
        ctx: {
            user: ctx.user
        }
    })
})
