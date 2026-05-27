import type { TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure } from '~/server/trpc'
import { taalSlugsList } from "~/components/Icons"
import { TRPCError } from '@trpc/server/unstable-core-do-not-import'

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
    })
} satisfies TRPCRouterRecord
