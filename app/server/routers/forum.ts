import type { TRPCRouterRecord } from '@trpc/server'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, publicProcedure, veryProtectedProcedure } from '~/server/trpc'
import { TaalSlugEnum } from '~/components/Icons'
import { sendMessageToDiscord } from '~/utils/discord.server'
import { send } from 'vite'
import config from "~/utils/config"

export const forumRouter = {
    getPosts: publicProcedure
        .input(
            z.object({
                // filters
                subject: z.string().length(2).optional(),
                authorId: z.uuid().optional(),
                // standaard nemen we 20 posts
                take: z.number().min(1).max(100).optional(),
                skip: z.number().min(0).optional()
            })
        )
        .query(async ({ input, ctx }) => {
            // we halen een config op waarin staat of we safeMode aan hebben staan
            const safeModeDB = await ctx.prisma.config.findFirst({
                where: {
                    key: 'safeMode'
                }
            })

            let safeModeValue = undefined
            if (safeModeDB) {
                safeModeValue = safeModeDB.value
            } else {
                safeModeValue = config.defaults.forum.safeMode
                await ctx.prisma.config.create({
                    data: {
                        key: 'safeMode',
                        value: safeModeValue
                    }
                })
            }

            const posts = await ctx.prisma.forumPost.findMany({
                where: {
                    subject: input.subject,
                    authorId: input.authorId,
                    ...(safeModeValue ? { hasBeenAdminChecked: true } : {})
                },
                take: input.take ?? 20,
                skip: input.skip ?? 0,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                }
            })

            return posts

        }),
    makePost: protectedProcedure
        .input(
            z.object({
                title: z.string().min(1).max(100),
                content: z.string().min(1).max(5000),
                subject: z.string().length(2)
            })
        )
        .mutation(async ({ input, ctx }) => {
            if (!Object.values(TaalSlugEnum).includes(input.subject as TaalSlugEnum)) {
                throw new Error("Invalid subject")
            }
            const newPost = await ctx.prisma.forumPost.create({
                data: {
                    title: input.title,
                    content: input.content,
                    authorId: ctx.user.id,
                    subject: input.subject
                }
            })
            return newPost
        }),
    getSpecificPost: publicProcedure
        .input(
            z.object({
                postId: z.uuid()
            })
        )
        .query(async ({ input, ctx }) => {
            const safeMode = await ctx.prisma.config.findFirstOrThrow({
                where: {
                    key: 'safeMode'
                }
            })
            let post = await ctx.prisma.forumPost.findUnique({
                // FIX DE FUCKING INTENDED BEHAVIOUR
                where: (safeMode.value && !(ctx.user?.role == "admin")) ? { hasBeenAdminChecked: true, id: input.postId } : { id: input.postId },


                // we willen ook 
                // - replies met authors
                // - author van de post
                // - votes op de post
                // postgers is nice
                include: {
                    replies: {
                        where: safeMode.value ? { hasBeenAdminChecked: true } : undefined,
                        include: {
                            author: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        },
                    },
                    author: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    votes: true
                }
            })
            if (!post) {
                return null
            }

            const userVote = ctx.user
                ? post.votes.find((vote) => vote.userId === ctx.user!.id)?.vote ?? null
                : null

            return {
                ...post,
                userVote
            }
        }),
    votePost: protectedProcedure
        .input(
            z.object({
                postId: z.uuid(),
                vote: z.enum(['UPVOTE', 'DOWNVOTE'])
            })
        )
        .mutation(async ({ input, ctx }) => {
            // check if user has already voted
            const existingVote = await ctx.prisma.forumVote.findFirst({
                where: {
                    userId: ctx.user.id,
                    postId: input.postId
                }
            })
            const post = await ctx.prisma.forumPost.findUnique({
                where: {
                    id: input.postId
                }
            })
            if (!post) {
                throw new Error("Post does not exist")
            }
            if (existingVote) {
                // update existing vote
                const updatedVote = await ctx.prisma.forumVote.update({
                    where: {
                        id: existingVote.id
                    },
                    data: {
                        vote: input.vote
                    },
                })
                return updatedVote
            } else {
                // create new vote
                const newVote = await ctx.prisma.forumVote.create({
                    data: {
                        vote: input.vote,
                        userId: ctx.user.id,
                        postId: input.postId
                    },
                })
                return newVote
            }
        }),
    replyToPost: protectedProcedure
        .input(
            z.object({
                postId: z.uuid(),
                content: z.string().min(1).max(2000)
            })
        )
        .mutation(async ({ input, ctx }) => {
            const newReply = await ctx.prisma.forumPostReply.create({
                data: {
                    content: input.content,
                    postId: input.postId,
                    authorId: ctx.user.id,
                    hasBeenAdminChecked: false
                }
            })
            return newReply
        }),
    deleteItem: protectedProcedure
        .input(
            z.object({
                type: z.enum(['POST', 'REPLY']),
                id: z.uuid()
            })
        )
        .mutation(async ({ input, ctx }) => {
            const isUserAdmin = (ctx.user.role ?? "user").includes('admin')
            if (input.type === 'POST') {
                // maker/admin check!
                const vraag = await ctx.prisma.forumPost.findUniqueOrThrow({
                    where: {
                        id: input.id
                    }
                })
                if (vraag.authorId !== ctx.user.id && !isUserAdmin) {
                    throw new Error("Not authorized to delete this post")
                }

                if (isUserAdmin) {
                    const post = await ctx.prisma.forumPost.findUniqueOrThrow({
                        where: {
                            id: input.id
                        }
                    })
                    sendMessageToDiscord({
                        title: 'Forum Post Deleted by Admin: ' + post.title,
                        color: 16711680,
                        description: post.content,
                        timestamp: new Date().toISOString(),
                        author: {
                            name: ctx.user.name
                        },
                    })
                }
                await ctx.prisma.forumVote.deleteMany({
                    where: {
                        postId: input.id
                    }
                })
                await ctx.prisma.forumPostReply.deleteMany({
                    where: {
                        postId: input.id
                    }
                })
                await ctx.prisma.forumPost.delete({
                    where: {
                        id: input.id
                    }
                })
            } else if (input.type === 'REPLY') {
                const vraag = await ctx.prisma.forumPostReply.findUniqueOrThrow({
                    where: {
                        id: input.id
                    }
                })
                if (vraag.authorId !== ctx.user.id) {
                    if (!isUserAdmin) {
                        throw new Error("Not authorized to delete this post")
                    }
                }

                await ctx.prisma.forumPostReply.delete({
                    where: {
                        id: input.id
                    }
                })
            }
        }),
    forumReviewQueue: veryProtectedProcedure.query(async ({ ctx }) => {
        const pendingPosts = await ctx.prisma.forumPost.findMany({
            where: {
                hasBeenAdminChecked: false
            },
            orderBy: {
                createdAt: 'asc'
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true
                    }
                },
            }
        })
        return pendingPosts
    }),
    forumReplyReviewQueue: veryProtectedProcedure.query(async ({ ctx }) => {
        const pendingReplies = await ctx.prisma.forumPostReply.findMany({
            where: {
                hasBeenAdminChecked: false
            },
            orderBy: {
                createdAt: 'asc'
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                post: {
                    select: {
                        id: true,
                        title: true
                    }
                }
            }
        })
        return pendingReplies
    }),
    forumReviewApprove: veryProtectedProcedure.input(
        z.union([
            z.object({
                postId: z.uuid()
            }),
            z.object({
                type: z.enum(['POST', 'REPLY']),
                id: z.uuid()
            })
        ])
    ).mutation(async ({ input, ctx }) => {
        if ('postId' in input) {
            await ctx.prisma.forumPost.update({
                where: {
                    id: input.postId
                },
                data: {
                    hasBeenAdminChecked: true
                }
            })
            return
        }

        if (input.type === 'POST') {
            await ctx.prisma.forumPost.update({
                where: {
                    id: input.id
                },
                data: {
                    hasBeenAdminChecked: true
                }
            })
            return
        }

        await ctx.prisma.forumPostReply.update({
            where: {
                id: input.id
            },
            data: {
                hasBeenAdminChecked: true
            }
        })
    }),
    nukeForum: veryProtectedProcedure.mutation(async ({ ctx }) => {
        const [deletedVotes, deletedReplies, deletedPosts] = await ctx.prisma.$transaction([
            ctx.prisma.forumVote.deleteMany({}),
            ctx.prisma.forumPostReply.deleteMany({}),
            ctx.prisma.forumPost.deleteMany({}),
        ])

        sendMessageToDiscord({
            title: 'Forum Nuked',
            description: `The forum was nuked by ${ctx.user.name}. Deleted ${deletedPosts.count} posts, ${deletedReplies.count} replies and ${deletedVotes.count} votes.`,
            color: 0xFF0000,
            timestamp: new Date().toISOString(),
        })

        return {
            success: true,
            deleted: {
                votes: deletedVotes.count,
                replies: deletedReplies.count,
                posts: deletedPosts.count,
            },
        }
    }),

    userForumBan: veryProtectedProcedure.input(
        z.object({
            userId: z.uuid(),
            ban: z.boolean(),
            banReason: z.string().max(500).optional(),
            banFull: z.boolean().default(false).optional()
        })
    ).mutation(async ({ input, ctx }) => {
        if (input.banFull) {
            await ctx.prisma.user.update({
                where: {
                    id: input.userId
                },
                data: {
                    banned: input.ban,
                    banReason: input.banReason ?? undefined
                }
            })

        } else {
            await ctx.prisma.user.update({
                where: {
                    id: input.userId
                },
                data: {
                    forumBanned: input.ban,
                    banReason: input.banReason ?? undefined
                }
            })

        }

        if (input.ban) {
            await sendMessageToDiscord({
                title: 'User Banned',
                description: `User with ID ${input.userId} was forum or platform banned by ${ctx.user.name}.`,
                color: 0xFF0000, // rood
                author: {
                    name: ctx.user.name
                },
                timestamp: new Date().toISOString(),
            })
        } else {
            await sendMessageToDiscord({
                title: 'User Unbanned',
                description: `User with ID ${input.userId} was forum or platform unbanned by ${ctx.user.name}.`,
                author: {
                    name: ctx.user.name
                },
                color: 0x00FF00, // groen
                timestamp: new Date().toISOString(),
            })
        }

        return { success: true }
    })
}
