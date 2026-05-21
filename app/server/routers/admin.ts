import type { TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, publicProcedure, veryProtectedProcedure } from '~/server/trpc'
import { sendMessageToDiscord } from '~/utils/discord.server';

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
    }),
    nukeNotYetUsedDBTables: veryProtectedProcedure.mutation(async ({ ctx }) => {
      await ctx.prisma.listSessionItemAnswerHistory.deleteMany({});
      await ctx.prisma.listSessionItem.deleteMany({});
      await ctx.prisma.listSession.deleteMany({});
      sendMessageToDiscord({
        title: 'Admin Action: Nuke unused DB tables',
        description: `User ${ctx.user.name} (${ctx.user.id}) nuked the unused DB tables.`,
        color: 0x0000FF, // blue
        timestamp: new Date().toISOString(),
      })

    })
} satisfies TRPCRouterRecord

