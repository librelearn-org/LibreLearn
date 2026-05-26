import { createTRPCRouter } from './trpc'
import { greetingRouter as userRouter } from './routers/greeting'
import { learnRouting } from './routers/learn'
import { adminRouter } from './routers/admin'

export const appRouter = createTRPCRouter({
    user: userRouter,
    learn: learnRouting,
    admin: adminRouter
})

export type AppRouter = typeof appRouter
