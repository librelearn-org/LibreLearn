import type { TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure } from '~/server/trpc'
import { taalSlugsList } from "~/components/Icons"
import { TRPCError } from '@trpc/server/unstable-core-do-not-import'

function mapItemToKaartStaat(item: {
  id: string
  vraag: string
  antwoord: string
  fase: number
  methode: string
  lastReview: Date
  nextReview: Date
  metaData: unknown
}) {
  return {
    ...item,
    methodeId: item.methode,
    lastReviewed: item.lastReview,
    metaData: (item.metaData && typeof item.metaData === "object" && !Array.isArray(item.metaData)
      ? (item.metaData as Record<string, any>)
      : {}) as Record<string, any>,
  }
}

export const learnRouting = {
  upsertList: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        list: z.array(
          z.object({
            vraag: z.string().min(1).max(100),
            antwoord: z.string().min(1).max(100)
          })
        ),
        id: z.uuid().optional(),
        language: z.enum(taalSlugsList),
        fromLanguage: z.enum(taalSlugsList),
        toLanguage: z.enum(taalSlugsList)
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.id) {
        const list = await ctx.prisma.list.create({
          data: {
            language: input.language as string,
            name: input.name,
            ownerId: ctx.user.id,
            listItems: {
              create: input.list.map(item => ({
                vraag: item.vraag,
                antwoord: item.antwoord
              }))
            },
            fromLanguage: input.fromLanguage as string,
            toLanguage: input.toLanguage as string
          },
          include: { listItems: true }
        })
        return list
      }

      const listOld = await ctx.prisma.list.findFirst({
        where: {
          id: input.id
        }
      })

      if (!listOld) {
        throw new TRPCError({ message: "Lijst bestaat niet!", code: 'NOT_FOUND' })
      }

      if ((listOld.ownerId != ctx.user.id) && (listOld.ownerId !== null)) {
        if (!(ctx.user.role?.includes("admin"))) {
          throw new TRPCError({ message: "Niet jouw lijst!", code: 'UNAUTHORIZED' })
        }
      }

      const list = await ctx.prisma.list.update({
        where: {
          id: input.id
        },
        data: {
          id: input.id,
          language: input.language as string,
          fromLanguage: input.fromLanguage as string,
          toLanguage: input.toLanguage as string,
          name: input.name,
          ownerId: ctx.user.id,
          listItems: {
            deleteMany: {
              listId: input.id
            },
            create: input.list.map(item => ({
              vraag: item.vraag,
              antwoord: item.antwoord
            }))
          }
        },
        include: { listItems: true }
      })
      return list
    }),
  getUserLists: protectedProcedure
    .query(async ({ ctx }) => {
      const lists = await ctx.prisma.list.findMany({
        where: {
          ownerId: ctx.user.id
        },
        include: {
          owner: true,
          listItems: true
        },
      })
      return lists
    }),
  removeList: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .mutation(async ({ input, ctx }) => {
      const list = await ctx.prisma.list.findFirstOrThrow({
        where: {
          id: input.id
        }
      })
      if (list.ownerId !== ctx.user.id) {
        if (ctx.user.role !== "admin") {
          throw new Error("You do not have permission to delete this list")
        }
      }
      await ctx.prisma.list.delete({
        where: {
          id: input.id
        }
      })
    }),
  getList: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ input, ctx }) => {
      const list = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
        include: {
          listItems: true,
          owner: {
            select: {
              name: true
            }
          }
        }
      })
      return list
    }),
  getLearnSession: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      const session = await ctx.prisma.learnSession.findFirstOrThrow({
        where: {
          id: input.id,
          userId: ctx.user.id
        },
        include: {
          wachtrij: true
        }
      })
      return {
        ...session,
        wachtrij: session.wachtrij.map(mapItemToKaartStaat)
      }
    }),
  upsertLearnSession: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        wachtrij: z.array(
          z.object({
            id: z.string().optional(),
            vraag: z.string().min(1),
            antwoord: z.string().min(1),
            fase: z.number().int().optional().default(0),
            methodeId: z.string().optional(),
            methode: z.string().optional(),
            lastReviewed: z.coerce.date().optional(),
            lastReview: z.coerce.date().optional(),
            nextReview: z.coerce.date().optional(),
            metaData: z.record(z.string(), z.any()).optional().default({}),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const createItems = input.wachtrij.map((item) => ({
        vraag: item.vraag,
        antwoord: item.antwoord,
        fase: item.fase ?? 0,
        methode: item.methodeId ?? item.methode ?? "simple",
        lastReview: item.lastReviewed ?? item.lastReview ?? new Date(),
        nextReview: item.nextReview ?? new Date(),
        metaData: item.metaData ?? {},
      }))

      if (!input.id) {
        const session = await ctx.prisma.learnSession.create({
          data: {
            userId: ctx.user.id,
            wachtrij: {
              create: createItems,
            },
          },
          include: {
            wachtrij: true,
          },
        })
        return {
          ...session,
          wachtrij: session.wachtrij.map(mapItemToKaartStaat)
        }
      }

      const existingSession = await ctx.prisma.learnSession.findFirst({
        where: {
          id: input.id,
        },
        include: {
          wachtrij: true,
        },
      })

      if (!existingSession) {
        throw new TRPCError({ message: "Sessie bestaat niet!", code: "NOT_FOUND" })
      }

      if (existingSession.userId !== ctx.user.id && !ctx.user.role?.includes("admin")) {
        throw new TRPCError({ message: "Niet jouw sessie!", code: "UNAUTHORIZED" })
      }

      const oldItemIds = existingSession.wachtrij.map((item) => item.id)
      if (oldItemIds.length > 0) {
        await ctx.prisma.learnSessionItem.deleteMany({
          where: {
            id: { in: oldItemIds },
          },
        })
      }

      const session = await ctx.prisma.learnSession.update({
        where: {
          id: input.id,
        },
        data: {
          wachtrij: {
            create: createItems,
          },
        },
        include: {
          wachtrij: true,
        },
      })

      return {
        ...session,
        wachtrij: session.wachtrij.map(mapItemToKaartStaat)
      }
    })


} satisfies TRPCRouterRecord
