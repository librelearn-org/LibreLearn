import type { TRPCRouterRecord } from "@trpc/server";
import { type CardState, Grade, Phase } from "@siemsiem/learnlib";
import { z } from "zod";
import { protectedProcedure } from "~/server/trpc";
import { taalSlugsList } from "~/components/Icons";
import { TRPCError } from "@trpc/server/unstable-core-do-not-import";
import { learnFormat } from "../../../generated/prisma/enums";

function mapItemToCardState(item: {
  id: string;
  question: string;
  answer: string;
  phase: Phase;
  methodId: string;
  lastReviewed: Date;
  nextReview: Date;
  metadata: unknown;
  history?: Array<{
    cardId: string | null;
    date: Date;
    answer: string;
    grade: Grade;
  }>;
}): CardState {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    phase: item.phase,
    methodId: item.methodId,
    lastReviewed: item.lastReviewed,
    nextReview: item.nextReview,
    history: (item.history ?? []).map((h) => ({
      cardId: h.cardId ?? item.id,
      date: h.date,
      answer: h.answer,
      grade: h.grade,
    })),
    metadata:
      item.metadata &&
      typeof item.metadata === "object" &&
      !Array.isArray(item.metadata)
        ? (item.metadata as Record<string, any>)
        : {},
  };
}

const cardStateSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1),
  answer: z.string().min(1),
  phase: z.enum(Phase).optional().default(Phase.Learning),
  methodId: z.string().optional().default("simple"),
  lastReviewed: z.coerce.date().optional(),
  nextReview: z.coerce.date().optional(),
  history: z
    .array(
      z.object({
        cardId: z.string().optional(),
        date: z.coerce.date().optional(),
        answer: z.string(),
        grade: z.enum(Grade),
      }),
    )
    .optional()
    .default([]),
  metadata: z.record(z.string(), z.any()).optional().default({}),
});

export const learnRouting = {
  upsertList: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        list: z.array(
          z.object({
            vraag: z.string().min(1).max(100),
            antwoord: z.string().min(1).max(100),
          }),
        ),
        id: z.uuid().optional(),
        language: z.enum(taalSlugsList),
        fromLanguage: z.enum(taalSlugsList),
        toLanguage: z.enum(taalSlugsList),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const dag = 24 * 60 * 60 * 1000;
      const limit =
        Date.now() - ctx.user.createdAt.getTime() < 30 * dag ? 750 : 1500;
      if (input.list.length > limit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Een lijst mag maximaal ${limit} vragen hebben`,
        });
      }
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
              create: input.list.map((item) => ({
                vraag: item.vraag,
                antwoord: item.antwoord,
              })),
            },
            fromLanguage: input.fromLanguage as string,
            toLanguage: input.toLanguage as string,
          },
          include: { listItems: true },
        });
        return list;
      }

      const listOld = await ctx.prisma.list.findFirst({
        where: {
          id: input.id,
        },
      });

      if (!listOld) {
        throw new TRPCError({
          message: "Lijst bestaat niet!",
          code: "NOT_FOUND",
        });
      }

      if (listOld.ownerId !== ctx.user.id && listOld.ownerId !== null) {
        if (!ctx.user.role?.includes("admin")) {
          throw new TRPCError({
            message: "Niet jouw lijst!",
            code: "UNAUTHORIZED",
          });
        }
      }

      const list = await ctx.prisma.list.update({
        where: {
          id: input.id,
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
              listId: input.id,
            },
            create: input.list.map((item) => ({
              vraag: item.vraag,
              antwoord: item.antwoord,
            })),
          },
        },
        include: { listItems: true },
      });
      return list;
    }),
  getUserLists: protectedProcedure.query(async ({ ctx }) => {
    const lists = await ctx.prisma.list.findMany({
      where: {
        ownerId: ctx.user.id,
      },
      include: {
        owner: true,
        listItems: true,
      },
    });
    return lists;
  }),
  removeList: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const list = await ctx.prisma.list.findFirstOrThrow({
        where: {
          id: input.id,
        },
      });
      if (list.ownerId !== ctx.user.id) {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            message: "You do not have permission to delete this list",
            code: "FORBIDDEN",
          });
        }
      }
      await ctx.prisma.list.delete({
        where: {
          id: input.id,
        },
      });
    }),
  getList: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
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
              name: true,
            },
          },
        },
      });
      if (!list) {
        throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      }
      return list;
    }),
  getLearnSession: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const session = await ctx.prisma.learnSession.findFirstOrThrow({
        where: {
          id: input.id,
          userId: ctx.user.id,
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
              listItems: true,
            },
          },
        },
      });
      return {
        ...session,
        wachtrij: session.wachtrij.map(mapItemToCardState),
        lijst: session.lijst.map(mapItemToCardState),
      };
    }),
  upsertLearnSession: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        wachtrij: z.array(cardStateSchema),
        lijst: z.array(cardStateSchema).optional(),
        listId: z.uuidv4().optional(),
        methode: z.enum(learnFormat).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const masterItems = (
        input.lijst && input.lijst.length > 0 ? input.lijst : input.wachtrij
      ).map((item) => {
        const id =
          input.id && item.id && item.id.trim().length > 0
            ? item.id
            : crypto.randomUUID();
        return {
          ...item,
          id,
        };
      });

      const masterItemMap = new Map<string, (typeof masterItems)[0]>();
      masterItems.forEach((item) => masterItemMap.set(item.id, item));

      const wachtrijIds: string[] = [];
      for (const wItem of input.wachtrij) {
        if (wItem.id && masterItemMap.has(wItem.id)) {
          wachtrijIds.push(wItem.id);
        } else {
          const match = masterItems.find(
            (m) =>
              m.question === wItem.question &&
              m.answer === wItem.answer &&
              !wachtrijIds.includes(m.id),
          );
          if (match) {
            wachtrijIds.push(match.id);
          } else if (wItem.id) {
            wachtrijIds.push(wItem.id);
          }
        }
      }

      const createItemData = (item: (typeof masterItems)[0]) => ({
        id: item.id,
        question: item.question,
        answer: item.answer,
        phase: item.phase,
        methodId: item.methodId,
        lastReviewed: item.lastReviewed ?? new Date(),
        nextReview: item.nextReview ?? new Date(),
        metadata: item.metadata,
        history:
          item.history.length > 0
            ? {
                create: item.history.map((h) => ({
                  cardId: h.cardId ?? item.id,
                  date: h.date ?? new Date(),
                  answer: h.answer,
                  grade: h.grade,
                })),
              }
            : undefined,
      });

      if (!input.id) {
        await Promise.all(
          masterItems.map((item) =>
            ctx.prisma.learnSessionItem.create({
              data: createItemData(item),
            }),
          ),
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

        const wachtrijOrderMap = new Map(
          wachtrijIds.map((id, index) => [id, index]),
        );
        const sortedWachtrij = [...session.wachtrij].sort(
          (a, b) =>
            (wachtrijOrderMap.get(a.id) ?? 0) -
            (wachtrijOrderMap.get(b.id) ?? 0),
        );
        const lijstOrderMap = new Map(
          masterItems.map((item, index) => [item.id, index]),
        );
        const sortedLijst = [...session.lijst].sort(
          (a, b) =>
            (lijstOrderMap.get(a.id) ?? 0) - (lijstOrderMap.get(b.id) ?? 0),
        );

        return {
          ...session,
          wachtrij: sortedWachtrij.map(mapItemToCardState),
          lijst: sortedLijst.map(mapItemToCardState),
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
        throw new TRPCError({
          message: "Sessie bestaat niet!",
          code: "NOT_FOUND",
        });
      }

      if (
        existingSession.userId !== ctx.user.id &&
        !ctx.user.role?.includes("admin")
      ) {
        throw new TRPCError({
          message: "Niet jouw sessie!",
          code: "UNAUTHORIZED",
        });
      }

      const oldItemIds = Array.from(
        new Set([
          ...existingSession.wachtrij.map((item) => item.id),
          ...existingSession.lijst.map((item) => item.id),
        ]),
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
          }),
        ),
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

      const wachtrijOrderMap = new Map(
        wachtrijIds.map((id, index) => [id, index]),
      );
      const sortedWachtrij = [...session.wachtrij].sort(
        (a, b) =>
          (wachtrijOrderMap.get(a.id) ?? 0) - (wachtrijOrderMap.get(b.id) ?? 0),
      );
      const lijstOrderMap = new Map(
        masterItems.map((item, index) => [item.id, index]),
      );
      const sortedLijst = [...session.lijst].sort(
        (a, b) =>
          (lijstOrderMap.get(a.id) ?? 0) - (lijstOrderMap.get(b.id) ?? 0),
      );

      return {
        ...session,
        wachtrij: sortedWachtrij.map(mapItemToCardState),
        lijst: sortedLijst.map(mapItemToCardState),
      };
    }),
  getUserLearnSessions: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.learnSession.findMany({
      where: {
        userId: ctx.user.id,
      },
      include: {
        list: true,
      },
    });
  }),
} satisfies TRPCRouterRecord;
