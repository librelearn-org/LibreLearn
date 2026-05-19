import { createTRPCRouter } from './trpc'
import { forumRouter } from './routers/forum'

import { greetingRouter as userRouter } from './routers/greeting'
import { learnRouting } from './routers/learn'
import { adminRouter } from './routers/admin'

export const appRouter = createTRPCRouter({
    user: userRouter,
    forum: forumRouter,
    learn: learnRouting,
    admin: adminRouter
})

export type AppRouter = typeof appRouter
