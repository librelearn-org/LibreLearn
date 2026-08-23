import { TRPCError, type TRPCRouterRecord } from '@trpc/server'
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
          lists: true,
          accounts: true,
        }
      });
      return user;
    }),
  nukeNotYetUsedDBTables: veryProtectedProcedure.mutation(async ({ ctx }) => {
    // await ctx.prisma.listSessionItemAnswerHistory.deleteMany({});
    // await ctx.prisma.listSessionItem.deleteMany({});
    // await ctx.prisma.listSession.deleteMany({});
    sendMessageToDiscord({
      title: 'Admin Action: Nuke unused DB tables',
      description: `User ${ctx.user.name} (${ctx.user.id}) nuked the unused DB tables.`,
      color: 0x0000FF, // blue
      timestamp: new Date().toISOString(),
    })

  }),
  getAllUsers: veryProtectedProcedure
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
  toggleBanUser: veryProtectedProcedure
    .input(
      z.object({
        userId: z.string(),
        banned: z.boolean(),
        banReason: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Je kunt jezelf niet bannen.'
        });
      }
      const updatedUser = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: {
          banned: input.banned,
          banReason: input.banned ? (input.banReason ?? 'Verbannen door admin') : null
        }
      });

      sendMessageToDiscord({
        title: input.banned ? 'Gebruiker verbannen' : 'Gebruiker niet langer verbannen',
        description: `Admin ${ctx.user.name} heeft gebruiker ${updatedUser.name} (${updatedUser.id})  ${input.banned ? 'verbannen' : 'unbanned'} .`,
        color: input.banned ? 0xFF0000 : 0x00FF00,
        timestamp: new Date().toISOString(),
      });

      return updatedUser;
    }),
} satisfies TRPCRouterRecord


