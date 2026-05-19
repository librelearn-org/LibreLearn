import type { TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, publicProcedure, veryProtectedProcedure } from '~/server/trpc'

export const adminRouter = {
  getUserProfile: veryProtectedProcedure
    .input(
      z.uuid()
    ).query(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findFirstOrThrow({
        where: {
          id: input
        },
        include: {
          forumPosts: true,
          lists: true,
          accounts: true,
          forumPostReplies: true,
        }
      });
      return user;
    })
} satisfies TRPCRouterRecord

