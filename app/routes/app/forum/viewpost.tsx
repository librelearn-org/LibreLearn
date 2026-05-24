import type { Route } from "./+types/viewpost";
import { useEffect, useState } from "react";
import { redirect } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from "~/components/button/button"
import { useTranslation } from "react-i18next";
import { caller } from '~/utils/trpc/server.server'
import { useTRPC } from '~/utils/trpc/react'
// prisma types importen is zo lelijk
import type { ForumVoteModel } from "~/../generated/prisma/models"
import { ListContainer, ListItem } from "~/components/list/list";
import config from "~/utils/config";
import Md from "~/components/markdown/md";
import "~/components/text-field/text-field.css";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { getErrorMessage } from "~/utils/error-message";


export async function loader(loaderArgs: Route.LoaderArgs) {
    const postId = loaderArgs.params.postId;

    if (!postId) {
        return redirect('/app/forum');
    }

    try {
        const api = await caller(loaderArgs);
        const post = await api.forum.getSpecificPost({ postId });

        console.log(post);
        if (!post) {
            return redirect('/app/forum');
        }

        return post;
    } catch {
        return redirect('/app/forum');
    }
}

function countVotes(votes: ForumVoteModel[]) {
    let count = 0;
    votes.forEach((vote) => {
        if (vote.vote === 'UPVOTE') {
            count += 1;
        } else if (vote.vote === 'DOWNVOTE') {
            count -= 1;
        } else {
            console.warn('wat de hell');
        }
    });
    return count;
}
export default function Home({ loaderData: initialPost }: Route.ComponentProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const [replyview, setReplyview] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    const postId = initialPost.id;
    const [userVote, setUserVote] = useState<"UPVOTE" | "DOWNVOTE" | null>(null);

    const postQuery = useQuery(
        trpc.forum.getSpecificPost.queryOptions({ postId }, {
            initialData: initialPost,
            staleTime: config.refetchTime,
            refetchInterval: config.refetchTime,
            refetchIntervalInBackground: config.refetch
        })
    );

    useEffect(() => {
        setUserVote(postQuery.data?.userVote ?? null);
    }, [postQuery.data?.userVote]);

    const refreshPost = async () => {
        if (!postId) {
            return;
        }
        await queryClient.invalidateQueries(trpc.forum.getSpecificPost.queryFilter({ postId }));
    };

    const voteMutation = useMutation(
        trpc.forum.votePost.mutationOptions({
            onMutate: () => {
                setActionError(null);
            },
            onSuccess: (data, variables) => {
                setUserVote(variables.vote);
                refreshPost();
            },
            onError: (error) => {
                setActionError(getErrorMessage(error, 'errors.api.vote'));
            },
        })
    );

    const replyMutation = useMutation(
        trpc.forum.replyToPost.mutationOptions({
            onMutate: () => {
                setActionError(null);
            },
            onSuccess: async () => {
                setReplyview(false);
                setReplyContent('');
                await refreshPost();
            },
            onError: (error) => {
                setActionError(getErrorMessage(error, 'errors.api.reply'));
            },
        })
    );

    const post = postQuery.data ?? initialPost;
    const votes = countVotes(post?.votes || []);
    const createdAt = post?.createdAt ? new Date(post.createdAt).toLocaleDateString() : '';
    const repliesCount = post?.replies.length ?? 0;

    if (postQuery.isLoading) {
        return (
            <div className="flex w-full items-center justify-center p-8 text-neutral-300">
                {t('common:loading')}
            </div>
        );
    }

    if (postQuery.isError || !post) {
        return (
            <div className="flex w-full items-center justify-center p-8">
                <p className="w-full max-w rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
                    {getErrorMessage(postQuery.error, 'errors.api.generic')}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-start w-full p-0 m-0">
            <div className="w-full max-w flex flex-col gap-4 p-5">
                <div className="flex flex-row bg-librelearn-800 rounded-2xl p-6">
                    <div className="flex flex-col gap-2 ">
                        <h1 className="text-3xl font-bold">{post.title}</h1>
                        <p className="text-neutral-300">
                            {t("forum:viewpost:byOn", { author: post.author.name, date: createdAt })}
                        </p>

                        <p className="text-neutral-300 text-sm">
                            {t("forum:viewpost:stats", {
                                votes: votes > 0 ? `+${votes}` : votes,
                                replies: repliesCount,
                            })}
                        </p>

                        <Md content={post.content} />

                        <div className="flex flex-wrap items-center gap-1 mt-2">


                            <Button type="button" onClick={() => setReplyview(!replyview)} variant="secondary">
                                {replyview ? t("forum:viewpost:actions:cancel") : t("forum:viewpost:actions:reply")}
                            </Button>
                        </div>
                        {actionError && (
                            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
                                {actionError}
                            </p>
                        )}
                    </div>
                    <div className="ml-auto flex flex-col items-center gap-2">
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            <Button variant={"secondary"} onClick={() => voteMutation.mutate({ postId, vote: 'UPVOTE' })}>
                                {userVote === 'UPVOTE' ? <ArrowBigUp fill="#f87171" /> : <ArrowBigUp />}

                            </Button>
                            <span className="text-neutral-300">{votes}</span>
                            <Button variant={"secondary"} onClick={() => voteMutation.mutate({ postId, vote: 'DOWNVOTE' })}>
                                {userVote === 'DOWNVOTE' ? <ArrowBigDown fill="#9394fe" /> : <ArrowBigDown />}
                            </Button>
                        </div>
                    </div>
                </div>

                {replyview && (
                    <form
                        className="flex flex-col gap-4 bg-librelearn-800 rounded-2xl p-6"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!postId || !replyContent.trim()) {
                                return;
                            }
                            replyMutation.mutate({ postId, content: replyContent });
                        }}
                    >
                        <textarea
                            value={replyContent}
                            onChange={(event) => setReplyContent(event.target.value)}
                            placeholder={t("forum:viewpost:placeholders:reply")}
                            rows={6}
                            className='text-field1-large'
                            required
                        />
                        <div className="flex flex-wrap items-center gap-1">
                            <Button variant="secondary" type="submit" disabled={replyMutation.isPending}>
                                {t("forum:viewpost:actions:postReply")}
                            </Button>
                            <Button variant="secondary" type="button" onClick={() => setReplyview(false)}>{t("forum:viewpost:actions:cancel")}</Button>
                        </div>
                    </form>
                )}

                <div className="flex flex-col gap-3">
                    <h2 className="text-2xl font-bold">{t("forum:viewpost:repliesTitle")}</h2>

                    {repliesCount === 0 && (
                        <ListItem title={t("forum:viewpost:noReplies")} ></ListItem>
                    )}
                    {/* <ListContainer className="w-full max-w"> */}
                    {post.replies.map((reply) => (
                        <ListItem
                            key={reply.id}
                            subtitle={t("forum:viewpost:replyTitle", { name: reply.author.name, date: new Date(reply.createdAt).toLocaleDateString() })}
                            title={reply.content}
                            swapSubtitleAndTitle={true}
                            markdown={true}
                        />
                        // <div key={reply.id} className="bg-librelearn-800 rounded-2xl p-4">
                        //     <div className="flex flex-wrap items-center justify-between gap-2">
                        //         <h3 className="font-semibold text-lg text-gray-100">{reply.author.name}</h3>
                        //         <p className="text-gray-300 text-sm">{new Date(reply.createdAt).toLocaleDateString()}</p>

                        //     </div>
                        //     <p className="text-gray-100 mt-2 whitespace-pre-wrap">{reply.content}</p>
                        // </div>
                    ))}
                    {/* </ListContainer> */}
                </div>
            </div>
        </div>
    )
}
