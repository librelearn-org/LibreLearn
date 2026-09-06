import type { TRPCRouterRecord } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure } from '~/server/trpc'
import { taalSlugsList } from "~/components/Icons"
import { TRPCError } from '@trpc/server/unstable-core-do-not-import'
import { learnFormat } from '../../../generated/prisma/enums'

function mapItemToKaartStaat(item: {
  id: string
  vraag: string
  antwoord: string
  fase: number
  methode: string
  lastReview: Date
  nextReview: Date
  metaData: unknown
  history?: Array<{
    kaartId?: string | null
    date: Date
    antwoord: string
    goed: number
  }>
}) {
  return {
    ...item,
    methodeId: item.methode,
    lastReviewed: item.lastReview,
    history: (item.history ?? []).map((h) => ({
      kaartId: h.kaartId ?? item.id,
      date: h.date,
      antwoord: h.antwoord,
      goed: h.goed,
    })),
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
            owner: {
              connect: {
                id: ctx.user.id,
              },
            },
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

      if ((listOld.ownerId !== ctx.user.id) && (listOld.ownerId !== null)) {
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
          throw new TRPCError({ message: "You do not have permission to delete this list", code: 'FORBIDDEN' })
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
          wachtrij: {
            include: {
              history: true,
            },
          },
          lijst: {
            include: {
              history: true,
            },
          },
          list: {
            include: {
              listItems: true
            }
          }
        }
      })
      return {
        ...session,
        wachtrij: session.wachtrij.map(mapItemToKaartStaat),
        lijst: session.lijst.map(mapItemToKaartStaat),
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
            history: z.array(
              z.object({
                kaartId: z.string().optional(),
                date: z.coerce.date().optional(),
                antwoord: z.string(),
                goed: z.number().int(),
              })
            ).optional().default([]),
            metaData: z.record(z.string(), z.any()).optional().default({}),
          })
        ),
        lijst: z.array(
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
            history: z.array(
              z.object({
                kaartId: z.string().optional(),
                date: z.coerce.date().optional(),
                antwoord: z.string(),
                goed: z.number().int(),
              })
            ).optional().default([]),
            metaData: z.record(z.string(), z.any()).optional().default({}),
          })
        ).optional(),
        listId: z.uuidv4().optional(),
        methode: z.enum(learnFormat).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const masterItems = (input.lijst && input.lijst.length > 0 ? input.lijst : input.wachtrij).map((item) => {
        const id = input.id && item.id && item.id.trim().length > 0 ? item.id : crypto.randomUUID();
        return {
          ...item,
          id,
        };
      });

      const masterItemMap = new Map<string, typeof masterItems[0]>();
      masterItems.forEach((item) => masterItemMap.set(item.id, item));

      const wachtrijIds: string[] = [];
      for (const wItem of input.wachtrij) {
        if (wItem.id && masterItemMap.has(wItem.id)) {
          wachtrijIds.push(wItem.id);
        } else {
          const match = masterItems.find(
            (m) => m.vraag === wItem.vraag && m.antwoord === wItem.antwoord && !wachtrijIds.includes(m.id)
          );
          if (match) {
            wachtrijIds.push(match.id);
          } else if (wItem.id) {
            wachtrijIds.push(wItem.id);
          }
        }
      }

      const createItemData = (item: typeof masterItems[0]) => ({
        id: item.id,
        vraag: item.vraag,
        antwoord: item.antwoord,
        fase: item.fase ?? 0,
        methode: item.methodeId ?? item.methode ?? "simple",
        lastReview: item.lastReviewed ?? item.lastReview ?? new Date(),
        nextReview: item.nextReview ?? new Date(),
        metaData: item.metaData ?? {},
        history: item.history && item.history.length > 0 ? {
          create: item.history.map((h) => ({
            kaartId: h.kaartId ?? item.id,
            date: h.date ?? new Date(),
            antwoord: h.antwoord,
            goed: h.goed,
          }))
        } : undefined,
      });

      if (!input.id) {
        await Promise.all(
          masterItems.map((item) =>
            ctx.prisma.learnSessionItem.create({
              data: createItemData(item),
            })
          )
        );

        const session = await ctx.prisma.learnSession.create({
          data: {
            userId: ctx.user.id,
            listId: input.listId,
            learnFormat: input.methode,
            lijst: {
              connect: masterItems.map((item) => ({ id: item.id })),
            },
            wachtrij: {
              connect: wachtrijIds.map((id) => ({ id })),
            },
          },
          include: {
            wachtrij: {
              include: {
                history: true,
              },
            },
            lijst: {
              include: {
                history: true,
              },
            },
          },
        });

        const wachtrijOrderMap = new Map(wachtrijIds.map((id, index) => [id, index]));
        const sortedWachtrij = [...session.wachtrij].sort(
          (a, b) => (wachtrijOrderMap.get(a.id) ?? 0) - (wachtrijOrderMap.get(b.id) ?? 0)
        );
        const lijstOrderMap = new Map(masterItems.map((item, index) => [item.id, index]));
        const sortedLijst = [...session.lijst].sort(
          (a, b) => (lijstOrderMap.get(a.id) ?? 0) - (lijstOrderMap.get(b.id) ?? 0)
        );

        return {
          ...session,
          wachtrij: sortedWachtrij.map(mapItemToKaartStaat),
          lijst: sortedLijst.map(mapItemToKaartStaat),
        };
      }

      const existingSession = await ctx.prisma.learnSession.findFirst({
        where: {
          id: input.id,
        },
        include: {
          wachtrij: true,
          lijst: true,
        },
      });

      if (!existingSession) {
        throw new TRPCError({ message: "Sessie bestaat niet!", code: "NOT_FOUND" });
      }

      if (existingSession.userId !== ctx.user.id && !ctx.user.role?.includes("admin")) {
        throw new TRPCError({ message: "Niet jouw sessie!", code: "UNAUTHORIZED" });
      }

      const oldItemIds = Array.from(
        new Set([
          ...existingSession.wachtrij.map((item) => item.id),
          ...existingSession.lijst.map((item) => item.id),
        ])
      );
      if (oldItemIds.length > 0) {
        await ctx.prisma.learnSessionItem.deleteMany({
          where: {
            id: { in: oldItemIds },
          },
        });
      }

      await Promise.all(
        masterItems.map((item) =>
          ctx.prisma.learnSessionItem.create({
            data: createItemData(item),
          })
        )
      );

      const session = await ctx.prisma.learnSession.update({
        where: {
          id: input.id,
        },
        data: {
          ...(input.methode ? { learnFormat: input.methode } : {}),
          lijst: {
            set: masterItems.map((item) => ({ id: item.id })),
          },
          wachtrij: {
            set: wachtrijIds.map((id) => ({ id })),
          },
        },
        include: {
          wachtrij: {
            include: {
              history: true,
            },
          },
          lijst: {
            include: {
              history: true,
            },
          },
        },
      });

      const wachtrijOrderMap = new Map(wachtrijIds.map((id, index) => [id, index]));
      const sortedWachtrij = [...session.wachtrij].sort(
        (a, b) => (wachtrijOrderMap.get(a.id) ?? 0) - (wachtrijOrderMap.get(b.id) ?? 0)
      );
      const lijstOrderMap = new Map(masterItems.map((item, index) => [item.id, index]));
      const sortedLijst = [...session.lijst].sort(
        (a, b) => (lijstOrderMap.get(a.id) ?? 0) - (lijstOrderMap.get(b.id) ?? 0)
      );

      return {
        ...session,
        wachtrij: sortedWachtrij.map(mapItemToKaartStaat),
        lijst: sortedLijst.map(mapItemToKaartStaat),
      };
    }),
  getUserLearnSessions: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.prisma.learnSession.findMany({
        where: {
          userId: ctx.user.id,
        },
        include: {
          list: true
        }
      })
    })


} satisfies TRPCRouterRecord
