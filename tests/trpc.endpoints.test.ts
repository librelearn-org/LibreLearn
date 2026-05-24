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
  const postIds = [...createdPostIds];
  const listIds = [...createdListIds];
  const userIds = [...createdUserIds];

  await prisma.config.deleteMany(
    {
      where: {
        isConfig: true,
      }
    }
  );

  if (listIds.length > 0) {
    await prisma.listSessionItemAnswerHistory.deleteMany({
      where: {
        listSessionItem: {
          listSession: {
            listId: { in: listIds },
          },
        },
      },
    });
    await prisma.listSessionItem.deleteMany({
      where: {
        listSession: {
          listId: { in: listIds },
        },
      },
    });
    await prisma.listSession.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.listItemSaved.deleteMany({ where: { listId: { in: listIds } } });
    await prisma.list.deleteMany({ where: { id: { in: listIds } } });
  }

  if (postIds.length > 0) {
    await prisma.forumVote.deleteMany({ where: { postId: { in: postIds } } });
    await prisma.forumPostReply.deleteMany({ where: { postId: { in: postIds } } });
    await prisma.forumPost.deleteMany({ where: { id: { in: postIds } } });
  }

  if (userIds.length > 0) {
    await prisma.listSessionItemAnswerHistory.deleteMany({
      where: {
        OR: [
          {
            listSessionItem: {
              listSession: { userId: { in: userIds } },
            },
          },
          {
            listSessionItem: {
              listSession: {
                list: { ownerId: { in: userIds } },
              },
            },
          },
        ],
      },
    });
    await prisma.forumVote.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.forumPostReply.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.forumPost.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.listSessionItem.deleteMany({
      where: {
        OR: [
          { listSession: { userId: { in: userIds } } },
          { listSession: { list: { ownerId: { in: userIds } } } },
        ],
      },
    });
    await prisma.listSession.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { list: { ownerId: { in: userIds } } },
        ],
      },
    });
    await prisma.listItemSaved.deleteMany({
      where: {
        list: { ownerId: { in: userIds } },
      },
    });
    await prisma.list.deleteMany({ where: { ownerId: { in: userIds } } });
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
    describe("getUserForumPosts", () => {
      it("returns user's forum posts with user.getUserForumPosts", async () => {
        const user = await createTestUser();
        for (let i = 0; i < 10; i++) {
          const post = await prisma.forumPost.create({
            data: {
              title: `post-${Date.now()}-${i}`,
              content: "Body",
              subject: "js",
              authorId: user.id,
            },
          });
          createdPostIds.add(post.id);
        }

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        const result = await caller.user.getUserForumPosts({ take: 10, skip: 0 });

        expect(result.some((post) => post.authorId === user.id)).toBe(true);
        expect(result.length).toBe(10);
      });
      it("prevents access to user.getUserForumPosts without authentication", async () => {
        const { caller } = makeCaller();
        await expect(caller.user.getUserForumPosts({ take: 10, skip: 0 })).rejects.toBeInstanceOf(
          TRPCError
        );
      });
      it("checks pagination of user.getUserForumPosts", async () => {
        const user = await createTestUser();
        await prisma.config.upsert({
          where: {
            key: "safeMode",
          },
          update: {
            value: false,
          },
          create: {
            key: "safeMode",
            value: false,
          },
        })

        const firstPost = await prisma.forumPost.create({
          data: {
            title: `fist-post-${Date.now()}`,
            content: "Body",
            subject: "nl",
            authorId: user.id,
          },
        });
        createdPostIds.add(firstPost.id);
        for (let i = 0; i < 14; i++) {
          const post = await prisma.forumPost.create({
            data: {
              title: `post-${Date.now()}-${i}`,
              content: "Body",
              subject: "nl",
              authorId: user.id,
            },
          });
          createdPostIds.add(post.id);
        }


        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        const result = await caller.user.getUserForumPosts({ take: 10, skip: 5 });

        expect(result.length).toBe(10);
        expect(result.some((post) => post.id === firstPost.id)).toBe(true);
      });
      it("returns empty array when user has no posts with user.getUserForumPosts", async () => {
        const user = await createTestUser();

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        const result = await caller.user.getUserForumPosts({ take: 10, skip: 0 });

        expect(result.length).toBe(0);
      });
      it("prevent asking for to many posts by limiting to 20 with user.getUserForumPosts when not specified", async () => {
        const user = await createTestUser();
        for (let i = 0; i < 30; i++) {
          const post = await prisma.forumPost.create({
            data: {
              title: `post-${Date.now()}-${i}`,
              content: "Body",
              subject: "js",
              authorId: user.id,
            },
          });
          createdPostIds.add(post.id);
        }

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        const result = await caller.user.getUserForumPosts({});

        expect(result.length).toBe(20);
      });
    });

    it("allows admin to log with user.adminLog", async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser(true);

      const caller1 = makeCaller({ id: user1.id, email: user1.email, name: user1.name }).caller;
      await expect(caller1.user.adminLog({ message: "This is a test log from user1 (not admin)" })).rejects.toBeInstanceOf(TRPCError);

      const caller2 = makeCaller({ id: user2.id, email: user2.email, name: user2.name }).caller;
      const call = await caller2.user.adminLog({ message: "This is a test log from user2 (admin)" });
      expect(call.success).toBe(true);

    });

    describe("config", () => {
      it("allows admin to set and read config with user.setConfig and user.getConfig", async () => {
        const admin = await createTestUser(true);
        const { caller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });

        const originalFetch = globalThis.fetch;
        try {
          const setResult = await caller.user.setConfig({ key: "safeMode", value: true });
          expect(setResult.success).toBe(true);

          const byKey = await caller.user.getConfig({ key: "safeMode" });
          expect((byKey as any)?.key).toBe("safeMode");
          expect((byKey as any)?.value).toBe(true);

          const allConfigs = await caller.user.getConfig({});
          expect(Array.isArray(allConfigs)).toBe(true);
          expect((allConfigs as any[]).some((config: any) => config.key === "safeMode" && config.value === true)).toBe(true);
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      it("prevents non-admin users from setting or reading config", async () => {
        const user = await createTestUser();
        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });

        await expect(caller.user.setConfig({ key: "safeMode", value: true })).rejects.toBeInstanceOf(TRPCError);
        await expect(caller.user.getConfig({ key: "safeMode" })).rejects.toBeInstanceOf(TRPCError);
      });
    });
  });
  describe("forum", () => {

    it("Prevent anything from a forumbanned user", async () => {
      const user = await createTestUser();
      await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          forumBanned: true
        }
      })
      const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });

      await expect(caller.forum.getPosts({})).rejects.toBeInstanceOf(TRPCError);
    })


    describe("Posts", () => {
      it("queries forum posts with filters", async () => {
        const user = await createTestUser();
        const createdPost = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "js",
            authorId: user.id,
          },
          include: { author: true },
        });
        createdPostIds.add(createdPost.id);

        const { caller } = makeCaller();
        const result = await caller.forum.getPosts({
          subject: "js",
          take: 10,
          skip: 0,
        });

        expect(result.some((post) => post.id === createdPost.id)).toBe(true);
      });

      it("creates a forum post for authenticated user", async () => {
        const user = await createTestUser();

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        const created = await caller.forum.makePost({
          title: "Integration title",
          content: "Integration content",
          subject: 'nl',
        });
        createdPostIds.add(created.id);

        expect(created.authorId).toBe(user.id);

        const persisted = await prisma.forumPost.findUnique({ where: { id: created.id } });
        expect(persisted?.id).toBe(created.id);
      });

      it("Disallow forum posts for non existent subjects", async () => {
        const user = await createTestUser();

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        await expect(caller.forum.makePost({
          title: "Integration title",
          content: "Integration content",
          subject: "js",
        })).rejects.toBeInstanceOf(TRPCError);
      });

      it("prevents creating forum post for unauthenticated user", async () => {
        const { caller } = makeCaller();
        await expect(
          caller.forum.makePost({
            title: "Integration title",
            content: "Integration content",
            subject: "js",
          })
        ).rejects.toBeInstanceOf(TRPCError);
      });

      it("Check that we can get posts without authentication", async () => {
        const user = await createTestUser();
        const createdPost = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "js",
            authorId: user.id,
          },
          include: { author: true },
        });
        createdPostIds.add(createdPost.id);

        const { caller } = makeCaller();
        const result = await caller.forum.getPosts({
          subject: "js",
          take: 10,
          skip: 0,
        });

        expect(result.some((post) => post.id === createdPost.id)).toBe(true);
      });
    });

    describe("deletion", () => {
      describe("deletion of posts", () => {
        it("Check that we can delete posts that we made", async () => {
          const user = await createTestUser();
          const createdPost = await prisma.forumPost.create({
            data: {
              title: `post-${Date.now()}`,
              content: "Body",
              subject: "nl",
              authorId: user.id,
            },
            include: { author: true },
          });
          createdPostIds.add(createdPost.id);

          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
          await caller.forum.deleteItem({
            type: 'POST',
            id: createdPost.id,
          });

          const deleted = await prisma.forumPost.findUnique({ where: { id: createdPost.id } });
          expect(deleted).toBeNull();
        });

        it("Check that we cannot delete posts that we did not make", async () => {
          const user1 = await createTestUser();
          const user2 = await createTestUser();
          const createdPost = await prisma.forumPost.create({
            data: {
              title: `post-${Date.now()}`,
              content: "Body",
              subject: "nl",
              authorId: user1.id,
            },
            include: { author: true },
          });
          createdPostIds.add(createdPost.id);

          const caller2 = makeCaller({ id: user2.id, email: user2.email, name: user2.name }).caller;
          await expect(
            caller2.forum.deleteItem({
              type: 'POST',
              id: createdPost.id,
            })
          ).rejects.toBeInstanceOf(TRPCError);

          const notDeleted = await prisma.forumPost.findUnique({ where: { id: createdPost.id } });
          expect(notDeleted).not.toBeNull();
        });

        it("Check that we can delete a post thats not is our own if we are admin", async () => {
          const user1 = await createTestUser();
          const user2 = await createTestUser();
          // make user2 admin
          await prisma.user.update({
            where: { id: user2.id },
            data: { role: "admin" },
          });
          const createdPost = await prisma.forumPost.create({
            data: {
              title: `post-${Date.now()}`,
              content: "Body",
              subject: "nl",
              authorId: user1.id,
            },
            include: { author: true },
          });
          createdPostIds.add(createdPost.id);

          const caller2 = makeCaller({ id: user2.id, email: user2.email, name: user2.name }).caller;
          await caller2.forum.deleteItem({
            type: 'POST',
            id: createdPost.id,
          });

          const deleted = await prisma.forumPost.findUnique({ where: { id: createdPost.id } });
          expect(deleted).toBeNull();
        });
      })

      describe("deletion of replies", () => {
        it("Check that we can delete replies that we made", async () => {
          const user = await createTestUser();
          const createdPost = await prisma.forumPost.create({
            data: {
              title: `post-${Date.now()}`,
              content: "Body",
              subject: "nl",
              authorId: user.id,
            },
            include: { author: true },
          });
          createdPostIds.add(createdPost.id);

          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
          const createdReply = await caller.forum.replyToPost({
            postId: createdPost.id,
            content: "This is a reply",
          });

          await caller.forum.deleteItem({
            type: 'REPLY',
            id: createdReply.id,
          });

          const deleted = await prisma.forumPostReply.findUnique({ where: { id: createdReply.id } });
          expect(deleted).toBeNull();
        });
        it("Check that we cannot delete replies that we did not make", async () => {
          const user1 = await createTestUser();
          const user2 = await createTestUser();
          const createdPost = await prisma.forumPost.create({
            data: {
              title: `post-${Date.now()}`,
              content: "Body",
              subject: "nl",
              authorId: user1.id,
            },
            include: { author: true },
          });
          createdPostIds.add(createdPost.id);

          const caller1 = makeCaller({ id: user1.id, email: user1.email, name: user1.name }).caller;
          const createdReply = await caller1.forum.replyToPost({
            postId: createdPost.id,
            content: "This is a reply",
          });

          const caller2 = makeCaller({ id: user2.id, email: user2.email, name: user2.name }).caller;
          await expect(
            caller2.forum.deleteItem({
              type: 'REPLY',
              id: createdReply.id,
            })
          ).rejects.toBeInstanceOf(TRPCError);

          const notDeleted = await prisma.forumPostReply.findUnique({ where: { id: createdReply.id } });
          expect(notDeleted).not.toBeNull();
        });

        it("Check that we can delete a reply thats not is our own if we are admin", async () => {
          const user1 = await createTestUser();
          const user2 = await createTestUser();
          // make user2 admin
          await prisma.user.update({
            where: { id: user2.id },
            data: { role: "admin" },
          });

          const createdPost = await prisma.forumPost.create({
            data: {
              title: `post-${Date.now()}`,
              content: "Body",
              subject: "nl",
              authorId: user1.id,
            },
            include: { author: true },
          });
          createdPostIds.add(createdPost.id);

          const caller1 = makeCaller({ id: user1.id, email: user1.email, name: user1.name }).caller;
          const createdReply = await caller1.forum.replyToPost({
            postId: createdPost.id,
            content: "This is a reply",
          });

          const caller2 = makeCaller({ id: user2.id, email: user2.email, name: user2.name }).caller;
          await caller2.forum.deleteItem({
            type: 'REPLY',
            id: createdReply.id,
          });

          const deleted = await prisma.forumPostReply.findUnique({ where: { id: createdReply.id } });
          expect(deleted).toBeNull();
        })
      });
    });

    describe("voting", () => {
      it("allows authenticated user to vote on a post using votePost", async () => {
        const user = await createTestUser();
        const createdPost = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "js",
            authorId: user.id,
          },
        });
        createdPostIds.add(createdPost.id);

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        const vote = await caller.forum.votePost({
          postId: createdPost.id,
          vote: "UPVOTE",
        });

        expect(vote.postId).toBe(createdPost.id);
        expect(vote.userId).toBe(user.id);
        expect(vote.vote).toBe("UPVOTE");
      });

      it("prevents unauthenticated user from voting on a post using votePost", async () => {
        const user = await createTestUser();
        const createdPost = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "js",
            authorId: user.id,
          },
        });
        createdPostIds.add(createdPost.id);

        const { caller } = makeCaller();
        await expect(
          caller.forum.votePost({
            postId: createdPost.id,
            vote: "UPVOTE",
          })
        ).rejects.toBeInstanceOf(TRPCError);
      });

      it("Check that we cant vote 2 times on one post", async () => {
        const user = await createTestUser();
        const createdPost = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "js",
            authorId: user.id,
          },
        });
        createdPostIds.add(createdPost.id);

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        await caller.forum.votePost({
          postId: createdPost.id,
          vote: "UPVOTE",
        });

        await caller.forum.votePost({
          postId: createdPost.id,
          vote: "UPVOTE",
        });

        const votes = await prisma.forumVote.findMany({
          where: {
            postId: createdPost.id,
            userId: user.id,
          },
        });

        expect(votes.length).toBe(1);
        expect(votes[0].vote).toBe("UPVOTE");
      });
    });

    describe("the admin queue", () => {
      it("allow admins to see the forum queue with forum.getAdminQueue", async () => {
        const user = await createTestUser();
        const admin = await createTestUser(true);

        const createdPost = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "js",
            authorId: user.id,
          },
        });
        createdPostIds.add(createdPost.id);

        const { caller: adminCaller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });
        const queue = await adminCaller.forum.forumReviewQueue();

        expect(queue.some((post) => post.id === createdPost.id)).toBe(true);
      });

      it("prevents non-admins from seeing the forum queue with forum.getAdminQueue", async () => {
        const user = await createTestUser();

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        await expect(caller.forum.forumReviewQueue()).rejects.toBeInstanceOf(TRPCError);
      });

      it("allow admins to approve post so it no longer appears in the queue with forum.approvePost", async () => {
        const user = await createTestUser();
        const admin = await createTestUser(true);

        const createdPost = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "js",
            authorId: user.id,
          },
        });
        createdPostIds.add(createdPost.id);



        const { caller: adminCaller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });
        await expect(adminCaller.forum.forumReviewApprove({ postId: createdPost.id })).resolves.toBeUndefined();

        const queue = await adminCaller.forum.forumReviewQueue();
        expect(queue.some((post) => post.id === createdPost.id)).toBe(false);


      });
      it("prevents non-admins from approveing posts", async () => {
        const user = await createTestUser();
        const admin = await createTestUser(true);

        const createdPost = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "js",
            authorId: user.id,
          },
        });
        createdPostIds.add(createdPost.id);



        const { caller: nonAdminCaller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        expect(nonAdminCaller.forum.forumReviewApprove({ postId: createdPost.id })).rejects.toBeInstanceOf(TRPCError);

        const { caller: adminCaller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });
        const queue = await adminCaller.forum.forumReviewQueue();
        expect(queue.some((post) => post.id === createdPost.id)).not.toBe(false);


      });

      it("lets admins see pending replies and approve them", async () => {
        const user = await createTestUser();
        const admin = await createTestUser(true);

        await prisma.config.update({
          where: {
            key: "safeMode",
          },
          data: {
            value: true,
          },
        });

        const createdPost = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "nl",
            authorId: user.id,
            hasBeenAdminChecked: true,
          },
        });
        createdPostIds.add(createdPost.id);

        const { caller: userCaller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        const createdReply = await userCaller.forum.replyToPost({
          postId: createdPost.id,
          content: "Pending reply",
        });

        const { caller: adminCaller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });
        const pendingReplies = await adminCaller.forum.forumReplyReviewQueue();
        expect(pendingReplies.some((reply) => reply.id === createdReply.id)).toBe(true);

        const { caller: publicCaller } = makeCaller();
        const postBeforeApprove = await publicCaller.forum.getSpecificPost({ postId: createdPost.id });
        expect(postBeforeApprove?.replies.some((reply) => reply.id === createdReply.id)).toBe(false);

        await adminCaller.forum.forumReviewApprove({ type: "REPLY", id: createdReply.id });

        const postAfterApprove = await publicCaller.forum.getSpecificPost({ postId: createdPost.id });
        expect(postAfterApprove?.replies.some((reply) => reply.id === createdReply.id)).toBe(true);
      });

      it("prevents non-admins from seeing pending replies", async () => {
        const user = await createTestUser();
        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });

        await expect(caller.forum.forumReplyReviewQueue()).rejects.toBeInstanceOf(TRPCError);
      });
      it("hides unapproved posts from public getSpecificPost when safeMode is enabled", async () => {
        await prisma.config.upsert({
          where: {
            key: "safeMode",
          },
          update: {
            value: true,
          },
          create: {
            key: "safeMode",
            value: true,
          },
        });

        const hiddenContent = "This post should stay hidden until an admin approves it.";
        const author = await createTestUser();
        const { caller: authorCaller } = makeCaller({ id: author.id, email: author.email, name: author.name });

        const post = await authorCaller.forum.makePost({
          title: `pending-${Date.now()}`,
          content: hiddenContent,
          subject: "nl",
        });
        createdPostIds.add(post.id);

        const { caller: publicCaller } = makeCaller();
        const listedPosts = await publicCaller.forum.getPosts({});
        expect(listedPosts.some((candidate) => candidate.id === post.id)).toBe(false);

        const fetchedPost = await publicCaller.forum.getSpecificPost({ postId: post.id });
        expect(fetchedPost).toBeNull();
      });

      it("allows admins to fetch their own unapproved posts with getSpecificPost when safeMode is enabled", async () => {
        await prisma.config.upsert({
          where: {
            key: "safeMode",
          },
          update: {
            value: true,
          },
          create: {
            key: "safeMode",
            value: true,
          },
        });

        const hiddenContent = "This post should stay hidden until an admin approves it.";
        const author = await createTestUser(true);
        const { caller: adminCaller } = makeCaller({ id: author.id, email: author.email, name: author.name, role: "admin" });

        const post = await adminCaller.forum.makePost({
          title: `pending-${Date.now()}`,
          content: hiddenContent,
          subject: "nl",
        });
        createdPostIds.add(post.id);

        const { caller: publicCaller } = makeCaller();
        const listedPosts = await publicCaller.forum.getPosts({});
        expect(listedPosts.some((candidate) => candidate.id === post.id)).toBe(false);

        const fetchedPost = await adminCaller.forum.getSpecificPost({ postId: post.id });
        expect(fetchedPost?.id).toBe(post.id);
        expect(fetchedPost?.content).toBe(hiddenContent);
        expect(fetchedPost?.hasBeenAdminChecked).toBe(false);
      });
    })

    describe("nuke", () => {
      it("allows admins to nuke the forum with forum.nukeForum", async () => {
        const admin = await createTestUser(true);
        const { caller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });

        const post = await prisma.forumPost.create({
          data: {
            title: `post-${Date.now()}`,
            content: "Body",
            subject: "js",
            authorId: admin.id,
          },
        });
        createdPostIds.add(post.id);

        await caller.forum.nukeForum();

        const deletedPost = await prisma.forumPost.findUnique({ where: { id: post.id } });
        expect(deletedPost).toBeNull();
      });

      it("prevents non-admins from nuking the forum with forum.nukeForum", async () => {
        const user = await createTestUser();
        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        await expect(caller.forum.nukeForum()).rejects.toBeInstanceOf(TRPCError);
      })
    })

    describe("userForumBan", () => {
      it("allows admins to ban users from the forum", async () => {
        const admin = await createTestUser(true);
        const user = await createTestUser();
        const { caller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });

        await caller.forum.userForumBan({ userId: user.id, ban: true });

        const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
        expect(updatedUser?.forumBanned).toBe(true);
      });

      it("allows admin to provide a reason when banning users from the forum", async () => {
        const admin = await createTestUser(true);
        const user = await createTestUser();
        const { caller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });

        const reason = "Inappropriate behavior";
        await caller.forum.userForumBan({ userId: user.id, ban: true, banReason: reason });

        const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
        expect(updatedUser?.forumBanned).toBe(true);
        expect(updatedUser?.banReason).toBe(reason);
      });

      it("allows admins to unban users from the forum", async () => {
        const admin = await createTestUser(true);
        const user = await createTestUser();
        await prisma.user.update({
          where: { id: user.id },
          data: { forumBanned: true },
        });
        const { caller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });

        await caller.forum.userForumBan({ userId: user.id, ban: false });

        const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
        expect(updatedUser?.forumBanned).toBe(false);
      });

      it("banned users cannot access forum endpoints", async () => {
        const admin = await createTestUser(true);
        const user = await createTestUser();
        const { caller: adminCaller } = makeCaller({ id: admin.id, email: admin.email, name: admin.name });
        await adminCaller.forum.userForumBan({ userId: user.id, ban: true });

        const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
        await expect(caller.forum.getPosts({})).rejects.toBeInstanceOf(TRPCError);
        await expect(caller.forum.makePost({
          title: "Should not work",
          content: "Because the user is banned",
          subject: "js",
        })).rejects.toBeInstanceOf(TRPCError);
      });
    })
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
            fromLanguage: TaalSlugEnum.EN,
            toLanguage: TaalSlugEnum.NL,
          });
          expect(updated.id).toBe(createdList.id);
          expect(updated.name).toBe(updatedName);
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
    describe("sessions", () => {
      describe("startLearnSession", () => {
        it("starts a learn session with learn. startLearnSession", async () => {
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
          const session = await caller.learn.startLearnSession({ listId: createdList.id });

          expect(session.userId).toBe(user.id);
          expect(session.listId).toBe(createdList.id);
          expect(session.listSessionItems.length).toBe(1);
          expect(session.listSessionItems[0].vraag).toBe("vraag");
          expect(session.listSessionItems[0].antwoord).toBe("antwoord");
        });

        it("prevents starting a learn session for non-existent list", async () => {
          const user = await createTestUser();

          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
          await expect(
            caller.learn.startLearnSession({ listId: "non-existent-list-id" })
          ).rejects.toBeInstanceOf(TRPCError);
        });

        it("prevents starting a learn session for empty list", async () => {
          const user = await createTestUser();

          const createdList = await prisma.list.create({
            data: {
              name: `Empty List-${Date.now()}`,
              ownerId: user.id,
              fromLanguage: TaalSlugEnum.EN,
              toLanguage: TaalSlugEnum.NL,
            },
          });
          createdListIds.add(createdList.id);

          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
          await expect(
            caller.learn.startLearnSession({ listId: createdList.id })
          ).rejects.toBeInstanceOf(TRPCError);
        });
      });

      describe("updateLearnSessionItem", () => {

        it("updates learn session item with learn.updateLearnSessionItem", async () => {
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
          const session = await caller.learn.startLearnSession({ listId: createdList.id });

          const itemToUpdate = session.listSessionItems[0];
          const updated = await caller.learn.updateLearnSessionItem({
            listSessionIdItem: itemToUpdate.id,
            goed: true,
            round: 1,
            antwoord: "antwoord",
          });
          expect(updated.id).toBe(itemToUpdate.id);

          const persisted = await prisma.listSessionItem.findUnique({
            where: { id: itemToUpdate.id },
            include: { listSessionItemAnswerHistories: true },
          });
          expect(persisted?.listSessionItemAnswerHistories.length).toBe(1);
          expect(persisted?.listSessionItemAnswerHistories[0].round).toBe(1);
          expect(persisted?.listSessionItemAnswerHistories[0].goed).toBe(true);
          expect(persisted?.listSessionItemAnswerHistories[0].antwoord).toBe("antwoord");
        });
        it("prevent updating learn sessions not belonging to user with learn.updateLearnSessionItem", async () => {
          const user1 = await createTestUser();
          const user2 = await createTestUser();

          const createdList = await prisma.list.create({
            data: {
              name: `Topwoorden-${Date.now()}`,
              ownerId: user1.id,
              listItems: {
                create: [{ vraag: "vraag", antwoord: "antwoord" }],
              },
              fromLanguage: TaalSlugEnum.EN,
              toLanguage: TaalSlugEnum.NL,
            },
            include: { listItems: true },
          });
          createdListIds.add(createdList.id);

          const caller2 = makeCaller({ id: user2.id, email: user2.email, name: user2.name }).caller;
          const caller1 = makeCaller({ id: user1.id, email: user1.email, name: user1.name }).caller;
          const session = await caller2.learn.startLearnSession({ listId: createdList.id });

          const itemToUpdate = session.listSessionItems[0];
          await expect(
            caller1.learn.updateLearnSessionItem({
              listSessionIdItem: itemToUpdate.id,
              goed: true,
              round: 1,
              antwoord: "antwoord",
            })
          ).rejects.toBeInstanceOf(TRPCError);
        });

        it("prevents updating non-existent learn session item with learn.updateLearnSessionItem", async () => {
          const user = await createTestUser();

          const { caller } = makeCaller({ id: user.id, email: user.email, name: user.name });
          await expect(
            caller.learn.updateLearnSessionItem({
              listSessionIdItem: "non-existent-item-id",
              goed: true,
              round: 1,
              antwoord: "antwoord",
            })
          ).rejects.toBeInstanceOf(TRPCError);
        });
      });

      describe("getlearnSession", () => {
        it("retrieves a learn session with learn.getLearnSession", async () => {
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
          const session = await caller.learn.startLearnSession({ listId: createdList.id });

          const fetched = await caller.learn.getLearnSession(session.id);
          expect(fetched?.id).toBe(session.id);
          expect(fetched?.listSessionItems.length).toBe(1);
        });
        it("prevents retrieving learn sessions not belonging to user with learn.getLearnSession", async () => {
          const user1 = await createTestUser();
          const user2 = await createTestUser();

          const createdList = await prisma.list.create({
            data: {
              name: `Topwoorden-${Date.now()}`,
              ownerId: user1.id,
              listItems: {
                create: [{ vraag: "vraag", antwoord: "antwoord" }],
              },
              fromLanguage: TaalSlugEnum.EN,
              toLanguage: TaalSlugEnum.NL,
            },
            include: { listItems: true },
          });
          createdListIds.add(createdList.id);

          const caller1 = makeCaller({ id: user1.id, email: user1.email, name: user1.name }).caller;
          const caller2 = makeCaller({ id: user2.id, email: user2.email, name: user2.name }).caller;
          const session = await caller1.learn.startLearnSession({ listId: createdList.id });

          await expect(caller2.learn.getLearnSession(session.id)).rejects.toBeInstanceOf(TRPCError);
        });

        it("allow admins to get other users learn sessions with learn.getLearnSession", async () => {
          const user = await createTestUser();
          const admin = await createTestUser(true);

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

          const callerUser = makeCaller({ id: user.id, email: user.email, name: user.name }).caller;
          const callerAdmin = makeCaller({ id: admin.id, email: admin.email, name: admin.name }).caller;
          const session = await callerUser.learn.startLearnSession({ listId: createdList.id });

          const fetchedByAdmin = await callerAdmin.learn.getLearnSession(session.id);
          expect(fetchedByAdmin?.id).toBe(session.id);
          expect(fetchedByAdmin?.listSessionItems.length).toBe(1);
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
});