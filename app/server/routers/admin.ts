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

  }),
  getAllUsers: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        cursor: z.string().nullable().optional()
      }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const cursor = input?.cursor ?? undefined;

      const users = await ctx.prisma.user.findMany({
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      let nextCursor: string | null = null;
      if (users.length > limit) {
        const next = users.pop();
        nextCursor = next!.id;
      }

      return { users, nextCursor };
    }),
} satisfies TRPCRouterRecord

