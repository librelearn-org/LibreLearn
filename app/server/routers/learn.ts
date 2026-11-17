import { type CardState, Grade, Phase } from "@siemsiem/learnlib";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server/unstable-core-do-not-import";
import { z } from "zod";
import { taalSlugsList } from "~/components/Icons";
import { protectedProcedure } from "~/server/trpc";
import type { prisma as prismaClient } from "~/utils/prisma";
import { learnFormat } from "../../../generated/prisma/enums";

function progressKey(question: string, answer: string): string {
  return `${question}\0${answer}`;
}

/**
 * Verwijdert sessie-specifieke vlaggen (zoals SimpleMethod's learned/geleerd)
 * zodat langetermijn-metadata hergebruikt kan worden in een nieuwe sessie.
 */
function stripSessionFlags(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const {
    learned: _learned,
    geleerd: _geleerd,
    ...rest
  } = metadata as Record<string, unknown>;
  return rest;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

function extractSessionMethodId(config: unknown): string | undefined {
  if (!isPlainObject(config)) return undefined;
  const modules = config.__modules;
  if (!isPlainObject(modules)) return undefined;
  return typeof modules.methodId === "string" ? modules.methodId : undefined;
}

/**
 * Haalt metadata op voor een specifieke methode uit de opgeslagen per-methode structuur.
 * Ondersteunt ook legacy platte metadata als fallback wanneer `savedMethodId` overeenkomt.
 */
function getMethodMetadata(
  storedMetadata: unknown,
  targetMethodId: string,
  savedMethodId?: string,
): Record<string, unknown> {
  if (!isPlainObject(storedMetadata)) return {};
  if (isPlainObject(storedMetadata.__byMethod)) {
    const methodMeta = storedMetadata.__byMethod[targetMethodId];
    return isPlainObject(methodMeta) ? methodMeta : {};
  }
  if (!savedMethodId || savedMethodId === targetMethodId) {
    return storedMetadata;
  }
  return {};
}

/**
 * Slaat metadata per methode op onder `__byMethod[methodId]` zodat metadata
 * van verschillende leermethodes elkaar niet overschrijven.
 */
function mergeMethodMetadata(
  existingStored: unknown,
  existingMethodId: string | undefined,
  methodId: string,
  newMethodMeta: Record<string, unknown>,
): Record<string, unknown> {
  const byMethod: Record<string, Record<string, unknown>> = {};
  if (isPlainObject(existingStored)) {
    if (isPlainObject(existingStored.__byMethod)) {
      for (const [k, v] of Object.entries(existingStored.__byMethod)) {
        if (isPlainObject(v)) byMethod[k] = v;
      }
    } else if (existingMethodId && Object.keys(existingStored).length > 0) {
      byMethod[existingMethodId] = existingStored;
    }
  }
  byMethod[methodId] = newMethodMeta;
  return { __byMethod: byMethod };
}

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

type ProgressSyncItem = {
  id: string;
  question: string;
  answer: string;
  phase: Phase;
  methodId: string;
  lastReviewed?: Date;
  nextReview?: Date;
  metadata: Record<string, unknown>;
  history: Array<{
    cardId?: string;
    date?: Date;
    answer: string;
    grade: Grade;
  }>;
};

async function syncUserCardProgress(
  prisma: typeof prismaClient,
  userId: string,
  listId: string | null | undefined,
  items: ProgressSyncItem[],
  activeMethodId?: string,
) {
  const deduped = new Map<string, ProgressSyncItem>();
  for (const item of items) {
    const hasProgress =
      item.history.length > 0 || Object.keys(item.metadata ?? {}).length > 0;
    if (hasProgress) {
      deduped.set(progressKey(item.question, item.answer), item);
    }
  }
  const reviewedItems = Array.from(deduped.values());
  if (reviewedItems.length === 0) return;

  const existingRows = await prisma.userCardProgress.findMany({
    where: {
      userId,
      OR: reviewedItems.map((item) => ({
        question: item.question,
        answer: item.answer,
      })),
    },
    select: {
      question: true,
      answer: true,
      listIds: true,
      methodId: true,
      metadata: true,
    },
  });
  const existingMap = new Map(
    existingRows.map((row) => [progressKey(row.question, row.answer), row]),
  );

  await Promise.all(
    reviewedItems.map((item) => {
      const existing = existingMap.get(progressKey(item.question, item.answer));
      const listIds = Array.from(
        new Set([...(existing?.listIds ?? []), ...(listId ? [listId] : [])]),
      );
      const historyCreate = item.history.map((h) => ({
        cardId: h.cardId ?? item.id,
        date: h.date ?? new Date(),
        answer: h.answer,
        grade: h.grade,
      }));
      const lastReviewed = item.lastReviewed ?? new Date();
      const nextReview = item.nextReview ?? new Date();
      const methodId = activeMethodId ?? item.methodId;
      const metadata = mergeMethodMetadata(
        existing?.metadata,
        existing?.methodId,
        methodId,
        item.metadata,
      ) as object;

      return prisma.userCardProgress.upsert({
        where: {
          userId_question_answer: {
            userId,
            question: item.question,
            answer: item.answer,
          },
        },
        create: {
          userId,
          listIds,
          question: item.question,
          answer: item.answer,
          phase: item.phase,
          methodId,
          lastReviewed,
          nextReview,
          metadata,
          history:
            historyCreate.length > 0 ? { create: historyCreate } : undefined,
        },
        update: {
          listIds,
          phase: item.phase,
          methodId,
          lastReviewed,
          nextReview,
          metadata,
          history: {
            deleteMany: {},
            ...(historyCreate.length > 0 ? { create: historyCreate } : {}),
          },
        },
      });
    }),
  );
}

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
  getListProgress: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const list = await ctx.prisma.list.findFirst({
        where: { id: input.id },
        select: {
          listItems: {
            select: { vraag: true, antwoord: true },
          },
        },
      });
      if (!list) {
        throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      }
      if (list.listItems.length === 0) {
        return { totalCount: 0, learnedCount: 0 };
      }
      const saved = await ctx.prisma.userCardProgress.findMany({
        where: {
          userId: ctx.user.id,
          OR: list.listItems.map((item) => ({
            question: item.vraag,
            answer: item.antwoord,
          })),
        },
        select: { question: true, answer: true },
      });
      const savedKeys = new Set(
        saved.map((s) => progressKey(s.question, s.answer)),
      );
      const learnedCount = list.listItems.filter((item) =>
        savedKeys.has(progressKey(item.vraag, item.antwoord)),
      ).length;
      return {
        totalCount: list.listItems.length,
        learnedCount,
      };
    }),
  getUserCardProgress: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.userCardProgress.findMany({
      where: {
        userId: ctx.user.id,
      },
      include: {
        history: {
          orderBy: { date: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }),
  getListCardProgress: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const list = await ctx.prisma.list.findFirst({
        where: { id: input.id },
        select: {
          listItems: {
            select: { vraag: true, antwoord: true },
          },
        },
      });
      if (!list) {
        throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });
      }
      if (list.listItems.length === 0) {
        return [];
      }
      return await ctx.prisma.userCardProgress.findMany({
        where: {
          userId: ctx.user.id,
          OR: list.listItems.map((item) => ({
            question: item.vraag,
            answer: item.antwoord,
          })),
        },
        include: {
          history: {
            orderBy: { date: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
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
          owner: {
            select: {
              learnConfig: true,
            },
          },
        },
      });
      const hasSessionConfig =
        session.config &&
        typeof session.config === "object" &&
        !Array.isArray(session.config) &&
        Object.keys(session.config).length > 0;
      return {
        ...session,
        config: (hasSessionConfig
          ? session.config
          : session.owner.learnConfig) as Record<string, unknown>,
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
        config: z.record(z.string(), z.any()).optional(),
        useSavedProgress: z.boolean().optional().default(true),
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
        const user = await ctx.prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { learnConfig: true },
        });

        let itemsToCreate = masterItems;
        if (input.useSavedProgress !== false && masterItems.length > 0) {
          const savedRows = await ctx.prisma.userCardProgress.findMany({
            where: {
              userId: ctx.user.id,
              OR: masterItems.map((item) => ({
                question: item.question,
                answer: item.answer,
              })),
            },
            include: {
              history: {
                orderBy: { date: "asc" },
              },
            },
          });
          const savedMap = new Map(
            savedRows.map((row) => [
              progressKey(row.question, row.answer),
              row,
            ]),
          );
          const sessionMethodId = extractSessionMethodId(
            input.config ?? user?.learnConfig,
          );
          itemsToCreate = masterItems.map((item) => {
            const saved = savedMap.get(progressKey(item.question, item.answer));
            if (!saved) return item;
            const targetMethodId = sessionMethodId ?? item.methodId;
            const savedMethodMeta = getMethodMetadata(
              saved.metadata,
              targetMethodId,
              saved.methodId,
            );
            return {
              ...item,
              phase: saved.phase as Phase,
              methodId: targetMethodId,
              lastReviewed: saved.lastReviewed,
              nextReview: saved.nextReview,
              metadata: {
                ...stripSessionFlags(savedMethodMeta),
                ...item.metadata,
              },
              history:
                item.history.length > 0
                  ? item.history
                  : saved.history.map((h) => ({
                      cardId: item.id,
                      date: h.date,
                      answer: h.answer,
                      grade: h.grade as Grade,
                    })),
            };
          });
        }

        await Promise.all(
          itemsToCreate.map((item) =>
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
            config: input.config ?? user?.learnConfig ?? {},
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

      await syncUserCardProgress(
        ctx.prisma,
        ctx.user.id,
        existingSession.listId,
        masterItems,
        extractSessionMethodId(input.config ?? existingSession.config),
      );

      const session = await ctx.prisma.learnSession.update({
        where: {
          id: input.id,
        },
        data: {
          ...(input.methode ? { learnFormat: input.methode } : {}),
          ...(input.config ? { config: input.config } : {}),
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
  getLearnConfig: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { learnConfig: true },
    });
    return (user?.learnConfig ?? {}) as Record<string, unknown>;
  }),
  updateLearnConfig: protectedProcedure
    .input(
      z.object({
        config: z.record(z.string(), z.any()),
        sessionId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { learnConfig: input.config },
      });
      if (input.sessionId) {
        await ctx.prisma.learnSession.updateMany({
          where: { id: input.sessionId, userId: ctx.user.id },
          data: { config: input.config },
        });
      }
      return input.config;
    }),
} satisfies TRPCRouterRecord;
