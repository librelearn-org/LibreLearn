import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { TRPCError } from "@trpc/server";
import type { AppRouter } from "~/server/main";
import { prisma } from "~/utils/prisma";
import { TaalSlugEnum } from "~/components/Icons";

type CallerContext = Parameters<AppRouter["createCaller"]>[0];

let appRouter: AppRouter;
const TEST_AUTH_SECRET = "12345678901234567890123456789012_test_secret_value";

const createdUserIds = new Set<string>();
const createdPostIds = new Set<string>();
const createdListIds = new Set<string>();

beforeAll(async () => {
  if (!process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = TEST_AUTH_SECRET;
  }

  ({ appRouter } = await import("~/server/main"));
});

beforeEach(async () => {
  const { setArtificialEndpointLag } = await import("~/server/trpc");
  setArtificialEndpointLag(false);
  // Ensure every test starts from a clean DB and deterministic auth config.
  await cleanupArtifacts();
  process.env.AUTH_SECRET = TEST_AUTH_SECRET;
  await prisma.config.upsert({
    where: { key: "safeMode" },
    update: { value: false },
    create: { key: "safeMode", value: false },
  });
});

afterEach(async () => {
  await cleanupArtifacts();
});

afterAll(async () => {
  await cleanupArtifacts();
  await prisma.$disconnect();
});

function makeCaller(user?: { id: string; email?: string; name?: string; role?: string }) {
  const ctx = { prisma, user } as unknown as CallerContext;
  const caller = appRouter.createCaller(ctx);
  return { caller };
}

async function createTestUser(admin?: boolean) {
  const userId = crypto.randomUUID();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user = await prisma.user.create({
    data: {
      id: userId,
      name: `Test User ${unique}`,
      email: `test-${unique}@example.com`,
      emailVerified: true,
      role: admin ? "admin" : "user",
    },
  });
  createdUserIds.add(user.id);
  return user;
}

async function cleanupArtifacts() {
  const listIds = [...createdListIds];
  const userIds = [...createdUserIds];

  await prisma.config.deleteMany(
    {
      where: {
        isConfig: true,
      }
    }
  );
  await prisma.listItemSaved.deleteMany({ where: { listId: { in: listIds } } });
  await prisma.list.deleteMany({ where: { id: { in: listIds } } });
  if (userIds.length > 0) {
    await prisma.list.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.learnSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.learnSessionItem.deleteMany({});
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  createdPostIds.clear();
  createdListIds.clear();
  createdUserIds.clear();
}

describe("tRPC endpoints (integration)", () => {
  describe("user", () => {
    it("nothing works if we are banned", async () => {
      const user = await createTestUser();
      await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          banned: true
        }
      });
      const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
      await expect(caller.user.hello()).rejects.toBeInstanceOf(TRPCError)
    })
    it("returns hello world from user.hello", async () => {
      const { caller } = makeCaller();
      const result = await caller.user.hello();
      expect(result).toBe("hello world");
    });

    it("rejects protected endpoint without user", async () => {
      const { caller } = makeCaller();
      await expect(caller.user.checkSession()).rejects.toBeInstanceOf(TRPCError);
    });
  });

  describe("learn", () => {
    describe("lists", () => {

      describe("Reading lists", () => {
        it("returns a list from learn. getList", async () => {
          const user = await createTestUser();

          const createdList = await prisma.list.create({
            data: {
              name: `Topwoorden-${Date.now()}`,
              ownerId: user.id,
              listItems: {
                create: [{ vraag: "vraag", antwoord: "antwoord" }],
              },
              fromLanguage: TaalSlugEnum.EN,
              toLanguage: TaalSlugEnum.NL,
            },
            include: { listItems: true },
          });
          createdListIds.add(createdList.id);

          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
          const result = await caller.learn.getList({ id: createdList.id });

          expect(result?.id).toBe(createdList.id);
          expect(result?.listItems.length).toBeGreaterThan(0);
        });

        it("prevents access to learn. getList for non-existent list", async () => {
          const user = await createTestUser();

          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
          const result = await caller.learn.getList({ id: "non-existent-list-id" });

          expect(result).toBeNull();
        });
      });

      describe("Creating and updating lists", () => {
        it("creates a list", async () => {
          const user = await createTestUser();

          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
          const created = await caller.learn.upsertList({
            name: `Topwoorden-${Date.now()}`,
            list: [
              { vraag: "vraag", antwoord: "antwoord" },
            ],
            language: TaalSlugEnum.NL,
            fromLanguage: TaalSlugEnum.EN,
            toLanguage: TaalSlugEnum.NL,
          });
          createdListIds.add(created.id);

          expect(created.ownerId).toBe(user.id);
          expect(created.listItems.length).toBe(1);
          expect(created.listItems[0].vraag).toBe("vraag");
          expect(created.listItems[0].antwoord).toBe("antwoord");
        })

        it("updates a list", async () => {
          const user = await createTestUser();
          const updatedName = `Updated Topwoorden-${Date.now()}`;

          const createdList = await prisma.list.create({
            data: {
              name: `Topwoorden-${Date.now()}`,
              ownerId: user.id,
              listItems: {
                create: [{ vraag: "vraag", antwoord: "antwoord" }],
              },
              fromLanguage: TaalSlugEnum.EN,
              toLanguage: TaalSlugEnum.NL,
            },
            include: { listItems: true },
          });
          createdListIds.add(createdList.id);

          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
          const updated = await caller.learn.upsertList({
            id: createdList.id,
            name: updatedName,
            list: [
              { vraag: "vraag2", antwoord: "antwoord2" },
            ],
            language: TaalSlugEnum.NL,
            fromLanguage: TaalSlugEnum.FR,
            toLanguage: TaalSlugEnum.EN,
          });
          expect(updated.id).toBe(createdList.id);
          expect(updated.name).toBe(updatedName);
          expect(updated.fromLanguage).toBe(TaalSlugEnum.FR);
          expect(updated.toLanguage).toBe(TaalSlugEnum.EN);
          expect(updated.listItems.length).toBe(1);
          expect(updated.listItems[0].vraag).toBe("vraag2");
          expect(updated.listItems[0].antwoord).toBe("antwoord2");
        });


      });

      it("get the users lists", async () => {
        const user = await createTestUser();

        const createdList1 = await prisma.list.create({
          data: {
            name: `Topwoorden1-${Date.now()}`,
            ownerId: user.id,
            listItems: {
              create: [{ vraag: "vraag1", antwoord: "antwoord1" }],
            },
            fromLanguage: TaalSlugEnum.EN,
            toLanguage: TaalSlugEnum.NL,
          },
          include: { listItems: true },
        });
        createdListIds.add(createdList1.id);

        const createdList2 = await prisma.list.create({
          data: {
            name: `Topwoorden2-${Date.now()}`,
            ownerId: user.id,
            listItems: {
              create: [{ vraag: "vraag2", antwoord: "antwoord2" }],
            },
            fromLanguage: TaalSlugEnum.EN,
            toLanguage: TaalSlugEnum.NL,
          },
          include: { listItems: true },
        });
        createdListIds.add(createdList2.id);

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        const lists = await caller.learn.getUserLists();

        expect(lists.some((list) => list.id === createdList1.id)).toBe(true);
        expect(lists.some((list) => list.id === createdList2.id)).toBe(true);
      });

    });

    describe("learnSession", () => {
      it("creates a learnSession and integrates seamlessly with Learnlib", async () => {
        const { default: Learnlib, simpleMethode, verySimple, simpleWachtrij } = await import("@siemsiem/learnlib");
        const user = await createTestUser();
        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });

        // 1. Create a learnSession
        const session = await caller.learn.upsertLearnSession({
          wachtrij: [
            { vraag: "cat", antwoord: "kat" },
            { vraag: "dog", antwoord: "hond" },
          ],
        });

        expect(session.id).toBeDefined();
        expect(session.userId).toBe(user.id);
        expect(session.wachtrij.length).toBe(2);

        // 2. Initialize Learnlib using the session's returned wachtrij
        const learnInstance = new Learnlib(
          session.wachtrij,
          new simpleMethode(),
          new verySimple(),
          new simpleWachtrij()
        );

        expect(learnInstance.current).toBeDefined();
        expect(learnInstance.wachtrij.length).toBe(2);

        // 3. Answer a card with Learnlib
        const currentAnswer = learnInstance.current.antwoord;
        learnInstance.antwoord(currentAnswer);

        // 4. Update the session with the new learnlib.wachtrij state
        const updatedSession = await caller.learn.upsertLearnSession({
          id: session.id,
          wachtrij: learnInstance.wachtrij,
        });

        expect(updatedSession.id).toBe(session.id);
        expect(updatedSession.wachtrij.length).toBe(1);

        // 5. Retrieve via getLearnSession and verify consistency
        const retrievedSession = await caller.learn.getLearnSession({ id: session.id });
        expect(retrievedSession.id).toBe(session.id);
        expect(retrievedSession.wachtrij.length).toBe(1);
        expect(retrievedSession.wachtrij[0].methodeId).toBeDefined();
        expect(retrievedSession.wachtrij[0].lastReviewed).toBeDefined();
      });


      it("prevents non-owner from updating a learnSession", async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        const { caller: caller1 } = makeCaller({ id: user1.id, email: user1.email, name: user1.name });
        const { caller: caller2 } = makeCaller({ id: user2.id, email: user2.email, name: user2.name });

        const session = await caller1.learn.upsertLearnSession({
          wachtrij: [{ vraag: "apple", antwoord: "appel" }],
        });

        await expect(
          caller2.learn.upsertLearnSession({
            id: session.id,
            wachtrij: [{ vraag: "banana", antwoord: "banaan" }],
          })
        ).rejects.toThrow("Niet jouw sessie!");
      });

      it("rejects updating non-existent learnSession", async () => {
        const user = await createTestUser();
        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });

        await expect(
          caller.learn.upsertLearnSession({
            id: "non-existent-session-id",
            wachtrij: [{ vraag: "hello", antwoord: "hallo" }],
          })
        ).rejects.toThrow("Sessie bestaat niet!");
      });

      describe("getLearnSession getter", () => {
        it("returns a learnSession by ID with mapped KaartStaat items for the session owner", async () => {
          const user = await createTestUser();
          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });

          const createdSession = await caller.learn.upsertLearnSession({
            wachtrij: [
              { vraag: "sun", antwoord: "zon", methodeId: "simple", metaData: { difficulty: 1 } },
              { vraag: "moon", antwoord: "maan", methodeId: "simple" },
            ],
          });

          const retrieved = await caller.learn.getLearnSession({ id: createdSession.id });

          expect(retrieved.id).toBe(createdSession.id);
          expect(retrieved.userId).toBe(user.id);
          expect(retrieved.wachtrij.length).toBe(2);

          const firstItem = retrieved.wachtrij.find((i) => i.vraag === "sun");
          expect(firstItem).toBeDefined();
          expect(firstItem?.antwoord).toBe("zon");
          expect(firstItem?.methodeId).toBe("simple");
          expect(firstItem?.lastReviewed).toBeInstanceOf(Date);
          expect(firstItem?.metaData).toEqual({ difficulty: 1 });
        });

        it("prevents retrieving a learnSession owned by another user", async () => {
          const owner = await createTestUser();
          const attacker = await createTestUser();

          const { caller: ownerCaller } = makeCaller({ id: owner.id, email: owner.email, name: owner.name });
          const { caller: attackerCaller } = makeCaller({ id: attacker.id, email: attacker.email, name: attacker.name });

          const session = await ownerCaller.learn.upsertLearnSession({
            wachtrij: [{ vraag: "secret", antwoord: "geheim" }],
          });

          await expect(
            attackerCaller.learn.getLearnSession({ id: session.id })
          ).rejects.toThrow();
        });

        it("throws an error when getLearnSession is called for a non-existent session ID", async () => {
          const user = await createTestUser();
          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });

          await expect(
            caller.learn.getLearnSession({ id: "invalid-uuid-12345" })
          ).rejects.toThrow();
        });
      });
    });
  });

  describe("admin", () => {

    it("allows admins to get user profile with admin.getUserProfile", async () => {
      const admin = await createTestUser(true);
      const user = await createTestUser();
      const { caller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });

      const profile = await caller.admin.getUserProfile(user.id);
      expect(profile?.id).toBe(user.id);
      expect(profile?.email).toBe(user.email);
    });
  });

  describe("artificial lag", () => {
    it.skip("delays endpoint response by 10 seconds when flag is enabled", async () => {
      const { setArtificialEndpointLag } = await import("~/server/trpc");
      const { caller } = makeCaller();
      setArtificialEndpointLag(true);
      const start = Date.now();
      try {
        const res = await caller.user.hello();
        const duration = Date.now() - start;
        expect(res).toBe("hello world");
        expect(duration).toBeGreaterThanOrEqual(9900);
      } finally {
        setArtificialEndpointLag(false);
      }
    }, 15000);
  });
});