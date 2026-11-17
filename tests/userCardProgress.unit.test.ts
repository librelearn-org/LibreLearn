import { describe, expect, it } from "bun:test";
import { Grade, Phase } from "@siemsiem/learnlib";
import { appRouter } from "~/server/main";
import { learnFormat } from "../generated/prisma/enums";

type CallerContext = Parameters<typeof appRouter.createCaller>[0];

function createInMemoryPrisma() {
  const users = new Map<string, { id: string; learnConfig: object }>();
  const lists = new Map<
    string,
    { id: string; listItems: Array<{ vraag: string; antwoord: string }> }
  >();
  const sessions = new Map<
    string,
    {
      id: string;
      userId: string;
      listId: string | null;
      learnFormat: learnFormat;
      config: object;
      lijstIds: string[];
      wachtrijIds: string[];
    }
  >();
  const sessionItems = new Map<
    string,
    {
      id: string;
      question: string;
      answer: string;
      phase: number;
      methodId: string;
      lastReviewed: Date;
      nextReview: Date;
      metadata: object;
      history: Array<{
        cardId: string | null;
        date: Date;
        answer: string;
        grade: number;
      }>;
    }
  >();
  const userProgress = new Map<
    string,
    {
      id: string;
      userId: string;
      listIds: string[];
      question: string;
      answer: string;
      phase: number;
      methodId: string;
      lastReviewed: Date;
      nextReview: Date;
      metadata: object;
      history: Array<{
        cardId: string | null;
        date: Date;
        answer: string;
        grade: number;
      }>;
    }
  >();

  const listSettings = new Map<
    string,
    {
      id: string;
      userId: string;
      listId: string;
      learnFormat: learnFormat;
      methodId: string;
      graderId: string;
      queueUpdaterId: string;
    }
  >();

  const progressKey = (userId: string, question: string, answer: string) =>
    `${userId}\0${question}\0${answer}`;

  const getItem = (itemId: string) => {
    const item = sessionItems.get(itemId);
    if (!item) throw new Error(`Missing session item ${itemId}`);
    return item;
  };

  const prismaMock = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users.get(where.id) ?? { id: where.id, learnConfig: {} },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { learnConfig: object };
      }) => {
        const updated = { id: where.id, learnConfig: data.learnConfig };
        users.set(where.id, updated);
        return updated;
      },
    },
    list: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        lists.get(where.id) ?? null,
    },
    learnSessionItem: {
      create: async ({
        data,
      }: {
        data: {
          id: string;
          question: string;
          answer: string;
          phase: number;
          methodId: string;
          lastReviewed: Date;
          nextReview: Date;
          metadata: object;
          history?: {
            create: Array<{
              cardId?: string;
              date?: Date;
              answer: string;
              grade: number;
            }>;
          };
        };
      }) => {
        const item = {
          id: data.id,
          question: data.question,
          answer: data.answer,
          phase: data.phase,
          methodId: data.methodId,
          lastReviewed: data.lastReviewed,
          nextReview: data.nextReview,
          metadata: data.metadata,
          history: (data.history?.create ?? []).map((h) => ({
            cardId: h.cardId ?? data.id,
            date: h.date ?? new Date(),
            answer: h.answer,
            grade: h.grade,
          })),
        };
        sessionItems.set(item.id, item);
        return item;
      },
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        for (const id of where.id.in) {
          sessionItems.delete(id);
        }
        return { count: where.id.in.length };
      },
    },
    learnSession: {
      create: async ({
        data,
      }: {
        data: {
          userId: string;
          listId?: string;
          learnFormat?: learnFormat;
          config: object;
          lijst: { connect: Array<{ id: string }> };
          wachtrij: { connect: Array<{ id: string }> };
        };
      }) => {
        const id = crypto.randomUUID();
        const row = {
          id,
          userId: data.userId,
          listId: data.listId ?? null,
          learnFormat: data.learnFormat ?? learnFormat.toets,
          config: data.config,
          lijstIds: data.lijst.connect.map((c) => c.id),
          wachtrijIds: data.wachtrij.connect.map((c) => c.id),
        };
        sessions.set(id, row);
        return {
          ...row,
          lijst: row.lijstIds.map(getItem),
          wachtrij: row.wachtrijIds.map(getItem),
        };
      },
      findFirst: async ({ where }: { where: { id: string } }) => {
        const row = sessions.get(where.id);
        if (!row) return null;
        return {
          ...row,
          lijst: row.lijstIds.map(getItem),
          wachtrij: row.wachtrijIds.map(getItem),
        };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          learnFormat?: learnFormat;
          config?: object;
          lijst: { set: Array<{ id: string }> };
          wachtrij: { set: Array<{ id: string }> };
        };
      }) => {
        const existing = sessions.get(where.id);
        if (!existing) throw new Error(`Missing session ${where.id}`);
        const updated = {
          ...existing,
          ...(data.learnFormat ? { learnFormat: data.learnFormat } : {}),
          ...(data.config ? { config: data.config } : {}),
          lijstIds: data.lijst.set.map((c) => c.id),
          wachtrijIds: data.wachtrij.set.map((c) => c.id),
        };
        sessions.set(where.id, updated);
        return {
          ...updated,
          lijst: updated.lijstIds.map(getItem),
          wachtrij: updated.wachtrijIds.map(getItem),
        };
      },
    },
    userCardProgress: {
      findMany: async ({
        where,
      }: {
        where: {
          userId: string;
          OR?: Array<{ question: string; answer: string }>;
        };
      }) => {
        return Array.from(userProgress.values()).filter(
          (row) =>
            row.userId === where.userId &&
            (!where.OR ||
              where.OR.some(
                (cond) =>
                  cond.question === row.question && cond.answer === row.answer,
              )),
        );
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: {
          userId_question_answer: {
            userId: string;
            question: string;
            answer: string;
          };
        };
        create: {
          userId: string;
          listIds: string[];
          question: string;
          answer: string;
          phase: number;
          methodId: string;
          lastReviewed: Date;
          nextReview: Date;
          metadata: object;
          history?: {
            create: Array<{
              cardId?: string;
              date?: Date;
              answer: string;
              grade: number;
            }>;
          };
        };
        update: {
          listIds: string[];
          phase: number;
          methodId: string;
          lastReviewed: Date;
          nextReview: Date;
          metadata: object;
          history: {
            deleteMany: object;
            create?: Array<{
              cardId?: string;
              date?: Date;
              answer: string;
              grade: number;
            }>;
          };
        };
      }) => {
        const k = progressKey(
          where.userId_question_answer.userId,
          where.userId_question_answer.question,
          where.userId_question_answer.answer,
        );
        const existing = userProgress.get(k);
        if (!existing) {
          const row = {
            id: crypto.randomUUID(),
            ...create,
            history: (create.history?.create ?? []).map((h) => ({
              cardId: h.cardId ?? null,
              date: h.date ?? new Date(),
              answer: h.answer,
              grade: h.grade,
            })),
          };
          userProgress.set(k, row);
          return row;
        }
        const row = {
          ...existing,
          listIds: update.listIds,
          phase: update.phase,
          methodId: update.methodId,
          lastReviewed: update.lastReviewed,
          nextReview: update.nextReview,
          metadata: update.metadata,
          history: (update.history.create ?? []).map((h) => ({
            cardId: h.cardId ?? null,
            date: h.date ?? new Date(),
            answer: h.answer,
            grade: h.grade,
          })),
        };
        userProgress.set(k, row);
        return row;
      },
    },
    userListSettings: {
      findUnique: async ({
        where,
      }: {
        where: { userId_listId: { userId: string; listId: string } };
      }) =>
        listSettings.get(
          `${where.userId_listId.userId}\0${where.userId_listId.listId}`,
        ) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId_listId: { userId: string; listId: string } };
        create: {
          userId: string;
          listId: string;
          learnFormat?: learnFormat;
          methodId?: string;
          graderId?: string;
          queueUpdaterId?: string;
        };
        update: {
          learnFormat?: learnFormat;
          methodId?: string;
          graderId?: string;
          queueUpdaterId?: string;
        };
      }) => {
        const k = `${where.userId_listId.userId}\0${where.userId_listId.listId}`;
        const existing = listSettings.get(k);
        const row = {
          id: existing?.id ?? crypto.randomUUID(),
          userId: where.userId_listId.userId,
          listId: where.userId_listId.listId,
          learnFormat:
            update.learnFormat ??
            create.learnFormat ??
            existing?.learnFormat ??
            learnFormat.toets,
          methodId:
            update.methodId ??
            create.methodId ??
            existing?.methodId ??
            "simple",
          graderId:
            update.graderId ?? create.graderId ?? existing?.graderId ?? "basic",
          queueUpdaterId:
            update.queueUpdaterId ??
            create.queueUpdaterId ??
            existing?.queueUpdaterId ??
            "simple",
        };
        listSettings.set(k, row);
        return row;
      },
    },
  };

  return { prismaMock, lists, userProgress };
}

describe("userCardProgress persistence", () => {
  it("persists metadata, review dates, listIds and history across sessions, stripping learned/geleerd", async () => {
    const { prismaMock, lists, userProgress } = createInMemoryPrisma();
    const list1Id = crypto.randomUUID();
    const list2Id = crypto.randomUUID();
    lists.set(list1Id, {
      id: list1Id,
      listItems: [
        { vraag: "hond", antwoord: "dog" },
        { vraag: "kat", antwoord: "cat" },
      ],
    });
    lists.set(list2Id, {
      id: list2Id,
      listItems: [{ vraag: "hond", antwoord: "dog" }],
    });

    const caller = appRouter.createCaller({
      prisma: prismaMock,
      user: { id: "user-1", role: "user" },
    } as unknown as CallerContext);

    // 1. Start session 1 on list1
    const s1 = await caller.learn.upsertLearnSession({
      listId: list1Id,
      methode: learnFormat.leren,
      lijst: [
        { question: "hond", answer: "dog" },
        { question: "kat", answer: "cat" },
      ],
      wachtrij: [
        { question: "hond", answer: "dog" },
        { question: "kat", answer: "cat" },
      ],
    });

    // 2. Answer "hond" in session 1
    const reviewedAt = new Date("2026-11-10T10:00:00.000Z");
    const nextAt = new Date("2026-11-15T10:00:00.000Z");
    await caller.learn.upsertLearnSession({
      id: s1.id,
      lijst: [
        {
          ...s1.lijst[0],
          phase: Phase.Review,
          methodId: "fsrs",
          lastReviewed: reviewedAt,
          nextReview: nextAt,
          metadata: {
            stability: 4.5,
            difficulty: 3.1,
            learned: true,
            geleerd: true,
          },
          history: [
            {
              cardId: s1.lijst[0].id,
              date: reviewedAt,
              answer: "dog",
              grade: Grade.Good,
            },
          ],
        },
        s1.lijst[1],
      ],
      wachtrij: [s1.lijst[1]],
    });

    // Only the reviewed card ("hond") is saved in userCardProgress
    expect(userProgress.size).toBe(1);

    // 3. getListProgress reports 1 of 2 learned
    const progress = await caller.learn.getListProgress({ id: list1Id });
    expect(progress).toEqual({ totalCount: 2, learnedCount: 1 });

    // 4. Start session 2 on list2 with fsrs (same word pair in another list)
    const s2 = await caller.learn.upsertLearnSession({
      listId: list2Id,
      methode: learnFormat.leren,
      config: { __modules: { methodId: "fsrs" } },
      lijst: [{ question: "hond", answer: "dog" }],
      wachtrij: [{ question: "hond", answer: "dog" }],
    });

    const restored = s2.lijst[0];
    expect(restored.phase).toBe(Phase.Review);
    expect(restored.methodId).toBe("fsrs");
    expect(restored.lastReviewed).toEqual(reviewedAt);
    expect(restored.nextReview).toEqual(nextAt);
    expect(restored.metadata).toEqual({ stability: 4.5, difficulty: 3.1 });
    expect(restored.metadata.learned).toBeUndefined();
    expect(restored.metadata.geleerd).toBeUndefined();
    expect(restored.history).toHaveLength(1);
    expect(restored.history[0].answer).toBe("dog");
    expect(restored.history[0].grade).toBe(Grade.Good);

    // 5. Updating session 2 appends list2Id to listIds
    await caller.learn.upsertLearnSession({
      id: s2.id,
      lijst: [restored],
      wachtrij: [],
    });
    const savedRow = Array.from(userProgress.values())[0];
    expect(savedRow.listIds).toEqual([list1Id, list2Id]);
  });

  it("ignores saved progress when useSavedProgress is false and isolates users", async () => {
    const { prismaMock } = createInMemoryPrisma();
    const listId = crypto.randomUUID();

    const caller1 = appRouter.createCaller({
      prisma: prismaMock,
      user: { id: "user-1", role: "user" },
    } as unknown as CallerContext);
    const caller2 = appRouter.createCaller({
      prisma: prismaMock,
      user: { id: "user-2", role: "user" },
    } as unknown as CallerContext);

    const s1 = await caller1.learn.upsertLearnSession({
      listId,
      lijst: [{ question: "appel", answer: "apple" }],
      wachtrij: [{ question: "appel", answer: "apple" }],
    });
    await caller1.learn.upsertLearnSession({
      id: s1.id,
      lijst: [
        {
          ...s1.lijst[0],
          metadata: { stability: 9.2 },
          history: [{ answer: "apple", grade: Grade.Easy }],
        },
      ],
      wachtrij: [],
    });

    // Same user opting out of saved progress
    const freshSession = await caller1.learn.upsertLearnSession({
      listId,
      useSavedProgress: false,
      lijst: [{ question: "appel", answer: "apple" }],
      wachtrij: [{ question: "appel", answer: "apple" }],
    });
    expect(freshSession.lijst[0].metadata).toEqual({});
    expect(freshSession.lijst[0].history).toEqual([]);

    // Different user starts clean even with useSavedProgress: true
    const otherUserSession = await caller2.learn.upsertLearnSession({
      listId,
      lijst: [{ question: "appel", answer: "apple" }],
      wachtrij: [{ question: "appel", answer: "apple" }],
    });
    expect(otherUserSession.lijst[0].metadata).toEqual({});
    expect(otherUserSession.lijst[0].history).toEqual([]);
  });

  it("isolates metadata per methodId while keeping shared history", async () => {
    const { prismaMock } = createInMemoryPrisma();
    const listId = crypto.randomUUID();
    const caller = appRouter.createCaller({
      prisma: prismaMock,
      user: { id: "user-1", role: "user" },
    } as unknown as CallerContext);

    // 1. Learn with fsrs
    const fsrsSession = await caller.learn.upsertLearnSession({
      listId,
      config: { __modules: { methodId: "fsrs" } },
      lijst: [{ question: "zon", answer: "sun" }],
      wachtrij: [{ question: "zon", answer: "sun" }],
    });
    await caller.learn.upsertLearnSession({
      id: fsrsSession.id,
      config: { __modules: { methodId: "fsrs" } },
      lijst: [
        {
          ...fsrsSession.lijst[0],
          methodId: "fsrs",
          metadata: { stability: 6.4, difficulty: 2.8 },
          history: [{ answer: "sun", grade: Grade.Good }],
        },
      ],
      wachtrij: [],
    });

    // 2. Start a session with simple: gets empty metadata, but keeps history
    const simpleSession = await caller.learn.upsertLearnSession({
      listId,
      config: { __modules: { methodId: "simple" } },
      lijst: [{ question: "zon", answer: "sun" }],
      wachtrij: [{ question: "zon", answer: "sun" }],
    });
    expect(simpleSession.lijst[0].methodId).toBe("simple");
    expect(simpleSession.lijst[0].metadata).toEqual({});
    expect(simpleSession.lijst[0].history).toHaveLength(1);

    // Answer in simple
    await caller.learn.upsertLearnSession({
      id: simpleSession.id,
      config: { __modules: { methodId: "simple" } },
      lijst: [
        {
          ...simpleSession.lijst[0],
          metadata: { learned: true },
          history: [
            ...simpleSession.lijst[0].history,
            { answer: "sun", grade: Grade.Good },
          ],
        },
      ],
      wachtrij: [],
    });

    // 3. Start a new fsrs session: fsrs metadata is still intact and history has 2 items
    const fsrsSession2 = await caller.learn.upsertLearnSession({
      listId,
      config: { __modules: { methodId: "fsrs" } },
      lijst: [{ question: "zon", answer: "sun" }],
      wachtrij: [{ question: "zon", answer: "sun" }],
    });
    expect(fsrsSession2.lijst[0].methodId).toBe("fsrs");
    expect(fsrsSession2.lijst[0].metadata).toEqual({
      stability: 6.4,
      difficulty: 2.8,
    });
    expect(fsrsSession2.lijst[0].history).toHaveLength(2);
  });

  it("fetches all user words via getUserCardProgress and per-list data via getListCardProgress", async () => {
    const { prismaMock, lists } = createInMemoryPrisma();
    const listA = crypto.randomUUID();
    const listB = crypto.randomUUID();
    lists.set(listA, {
      id: listA,
      listItems: [{ vraag: "boom", antwoord: "tree" }],
    });
    lists.set(listB, {
      id: listB,
      listItems: [{ vraag: "water", antwoord: "water" }],
    });

    const caller = appRouter.createCaller({
      prisma: prismaMock,
      user: { id: "user-1", role: "user" },
    } as unknown as CallerContext);

    const sA = await caller.learn.upsertLearnSession({
      listId: listA,
      lijst: [{ question: "boom", answer: "tree" }],
      wachtrij: [{ question: "boom", answer: "tree" }],
    });
    await caller.learn.upsertLearnSession({
      id: sA.id,
      lijst: [
        {
          ...sA.lijst[0],
          metadata: { stability: 2.1 },
          history: [{ answer: "tree", grade: Grade.Good }],
        },
      ],
      wachtrij: [],
    });

    const sB = await caller.learn.upsertLearnSession({
      listId: listB,
      lijst: [{ question: "water", answer: "water" }],
      wachtrij: [{ question: "water", answer: "water" }],
    });
    await caller.learn.upsertLearnSession({
      id: sB.id,
      lijst: [
        {
          ...sB.lijst[0],
          metadata: { stability: 5.0 },
          history: [{ answer: "water", grade: Grade.Easy }],
        },
      ],
      wachtrij: [],
    });

    const allWords = await caller.learn.getUserCardProgress();
    expect(allWords).toHaveLength(2);

    const listAProgress = await caller.learn.getListCardProgress({ id: listA });
    expect(listAProgress).toHaveLength(1);
    expect(listAProgress[0].question).toBe("boom");
    expect(listAProgress[0].history).toHaveLength(1);
  });

  it("remembers last selected format and modules per list in userListSettings", async () => {
    const { prismaMock } = createInMemoryPrisma();
    const listId = crypto.randomUUID();
    const caller = appRouter.createCaller({
      prisma: prismaMock,
      user: { id: "user-1", role: "user" },
    } as unknown as CallerContext);

    await caller.learn.upsertLearnSession({
      listId,
      methode: learnFormat.leren,
      config: {
        __modules: {
          methodId: "fsrs",
          graderId: "basic",
          queueUpdaterId: "simple",
        },
      },
      lijst: [{ question: "zon", answer: "sun" }],
      wachtrij: [{ question: "zon", answer: "sun" }],
    });

    const settings = await caller.learn.getListSettings({ id: listId });
    expect(settings).not.toBeNull();
    expect(settings?.learnFormat).toBe(learnFormat.leren);
    expect(settings?.methodId).toBe("fsrs");
    expect(settings?.graderId).toBe("basic");
    expect(settings?.queueUpdaterId).toBe("simple");
  });
});
