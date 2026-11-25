import { Grade, Phase } from "@siemsiem/learnlib";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "~/server/trpc";
import type { Prisma } from "../../../generated/prisma/client";
import { learnFormat, learnSessionTypes } from "../../../generated/prisma/enums";

export const cardHistItemZod = z.object({
  date: z.coerce.date(),
  cardId: z.string().optional(),
  answer: z.string(),
  grade: z.enum(Grade),
});

export const cardZod = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  methodId: z.string(),
  phase: z.enum(Phase),
  lastReviewed: z.coerce.date().nullish(),
  nextReview: z.coerce.date(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  history: z.array(cardHistItemZod).default([]),
});

export const queueStateZod = z.object({
  current: cardZod.nullable(),
  isDone: z.boolean(),
  initialCount: z.number(),
  progress: z.number(),
});

export const snapshotZod = z.object({
  cards: z.array(cardZod),
  queue: z.array(cardZod),
  queueState: queueStateZod,
});

// waarom study? omdat learn bezet wat. waarom die andere learn heet? omdat ik eerst naast lijsten ook de leer functie daar wou
export const studyRouting = {
  startSession: protectedProcedure
    .input(
      z.object({
        snapshot: snapshotZod,
        config: z.record(z.string(), z.unknown()).optional(),
        isSpaced: z.boolean().optional(),
        method: z.string().optional(),
        grader: z.string().optional(),
        queueUpdater: z.string().optional(),
        listId: z.string().optional(),
        learnFormat: z.enum(learnFormat),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const queueIndexById = new Map(
        input.snapshot.queue.map((card, idx) => [card.id, idx]),
      );
      return await ctx.prisma.learnSession.create({
        data: {
          type: input.isSpaced
            ? learnSessionTypes.SPACED
            : learnSessionTypes.SESSION,
          userId: ctx.user.id,
          methodId: input.method,
          graderId: input.grader,
          queueUpdaterId: input.queueUpdater,
          config: (input.config ?? {}) as Prisma.InputJsonValue,
          listId: input.listId,
          learnFormat: input.learnFormat,
          cards: {
            create: input.snapshot.cards.map((card) => ({
              question: card.question,
              answer: card.answer,
              phase: card.phase,
              queueIndex: queueIndexById.get(card.id) ?? null,
              lastReviewed: card.lastReviewed ?? null,
              nextReview: card.nextReview,
              metaData: card.metadata as Prisma.InputJsonObject,
              methodId: card.methodId,
              history:
                card.history.length > 0
                  ? {
                    create: card.history.map((h) => ({
                      cardId: h.cardId,
                      date: h.date,
                      answer: h.answer,
                      grade: h.grade,
                    })),
                  }
                  : undefined,
            })),
          },
        },
        include: {
          cards: {
            include: { history: true },
            orderBy: { queueIndex: "asc" },
          },
        },
      });
    }),
  syncSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.uuid(),
        config: z.record(z.string(), z.unknown()).optional(),
        snapshot: snapshotZod,
        grader: z.string().optional(),
        queueUpdater: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const session = await ctx.prisma.learnSession.findFirst({
        where: { id: input.sessionId, userId: ctx.user.id },
        select: { id: true, type: true, methodId: true },
      });
      if (!session) {
        throw new TRPCError({
          message: "Session does not exist",
          code: "NOT_FOUND",
        });
      }
      const queueIndexById = new Map(
        input.snapshot.queue.map((card, idx) => [card.id, idx]),
      );

      await ctx.prisma.$transaction(async (tx) => {
        await tx.learnSession.update({
          where: { id: session.id },
          data: {
            ...(input.config
              ? { config: input.config as Prisma.InputJsonValue }
              : {}),
            ...(input.grader ? { graderId: input.grader } : {}),
            ...(input.queueUpdater
              ? { queueUpdaterId: input.queueUpdater }
              : {}),
          },
        });

        for (const card of input.snapshot.cards) {
          await tx.learnSessionCard.update({
            where: { id: card.id, learnSessionId: session.id },
            data: {
              phase: card.phase,
              queueIndex: queueIndexById.get(card.id) ?? null,
              lastReviewed: card.lastReviewed ?? null,
              nextReview: card.nextReview,
              metaData: card.metadata as Prisma.InputJsonValue,
              history: {
                // we verwijderen eerst de card history om problemen te voorkomen met undo en te veel groeien
                deleteMany: {},
                create: card.history.map((h) => ({
                  cardId: h.cardId ?? card.id,
                  date: h.date,
                  answer: h.answer,
                  grade: h.grade,
                })),
              },
            },
          });
        }

        if (session.type === learnSessionTypes.SPACED) {
          // syncen met de blijvende record over het woord.
          const reviewedCards = input.snapshot.cards.filter(
            (c) => c.history.length > 0,
          );

          for (const card of reviewedCards) {
            const historyCreate = card.history.map((h) => ({
              cardId: h.cardId ?? card.id,
              date: h.date,
              answer: h.answer,
              grade: h.grade,
            }));

            const perm = await tx.userPermanentCardData.upsert({
              where: {
                userId_question_answer: {
                  userId: ctx.user.id,
                  question: card.question,
                  answer: card.answer,
                },
              },
              create: {
                userId: ctx.user.id,
                question: card.question,
                answer: card.answer,
                history: { create: historyCreate },
              },
              update: {
                history: {
                  deleteMany: {},
                  create: historyCreate,
                },
              },
            });

            await tx.linkedMetaData.upsert({
              where: {
                userPermanentCardDataId_method: {
                  userPermanentCardDataId: perm.id,
                  method: session.methodId,
                },
              },
              create: {
                userPermanentCardDataId: perm.id,
                method: session.methodId,
                phase: card.phase,
                lastReviewed: card.lastReviewed ?? null,
                nextReview: card.nextReview,
                data: card.metadata as Prisma.InputJsonValue,
              },
              update: {
                phase: card.phase,
                lastReviewed: card.lastReviewed ?? null,
                nextReview: card.nextReview,
                data: card.metadata as Prisma.InputJsonValue,
              },
            });
          }
        }
      });

      return { ok: true };
    }),
  getLearnSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const session = await ctx.prisma.learnSession.findFirst({
        where: {
          id: input.sessionId,
          userId: ctx.user.id,
        },
        include: {
          cards: {
            include: { history: { orderBy: { date: "asc" } } },
            orderBy: { queueIndex: "asc" },
          },
          list: {
            select: { id: true, name: true },
          },
        },
      });
      if (!session) {
        throw new TRPCError({
          message: "Session does not exist",
          code: "NOT_FOUND",
        });
      }
      return session;
    }),
} satisfies TRPCRouterRecord;
