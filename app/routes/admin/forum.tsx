import type { Route } from "./+types/forum";
import { caller } from '~/utils/trpc/server.server'
import { auth } from '~/utils/auth/server.server'
import { Button } from "~/components/button/button";
import { ListContainer, ListItem } from "~/components/list/list";
import { getSubjectBySlug, TaalSlugEnum } from "~/components/Icons";
import { useTRPC } from "~/utils/trpc/react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import config from "~/utils/config";
import { getErrorMessage } from "~/utils/error-message";

export async function loader(loaderArgs: Route.LoaderArgs) {
    const api = await caller(loaderArgs);
    const headers = new Headers(loaderArgs.request.headers)
    const result = await auth.api.getSession({ headers })
    const user = result?.user
    const forumPostsPreload = await api.forum.forumReviewQueue();
    const forumRepliesPreload = await api.forum.forumReplyReviewQueue();
    return { forumPostsPreload, forumRepliesPreload, user: user };
}

export default function ForumHome({ loaderData: { forumPostsPreload, forumRepliesPreload, user: user } }: Route.ComponentProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [isForumMutationHappening, setIsForumMutationHappening] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const reviewQueueInput = undefined;
    

    const { data: forumPosts, isLoading, error } = useQuery(
        trpc.forum.forumReviewQueue.queryOptions(reviewQueueInput, {
            initialData: forumPostsPreload,
            staleTime: config.refetchTime,
            refetchInterval: config.refetchTime,
            refetchIntervalInBackground: config.refetch
        })
    )
    const { data: forumReplies, error: forumRepliesError } = useQuery(
        trpc.forum.forumReplyReviewQueue.queryOptions(reviewQueueInput, {
            initialData: forumRepliesPreload,
            staleTime: config.refetchTime,
            refetchInterval: config.refetchTime,
            refetchIntervalInBackground: config.refetch
        })
    )
    const reviewQueueError = error ?? forumRepliesError;

    const deletePostMutation = useMutation(
        trpc.forum.deleteItem.mutationOptions({
            onMutate: () => {
                setMutationError(null);
                setIsForumMutationHappening(true);
            },
            onError: (err) => {
                setMutationError(getErrorMessage(err));
            },
            onSettled: async (_data, _error) => {
                setIsForumMutationHappening(false);
                await queryClient.invalidateQueries({
                    queryKey: trpc.forum.forumReviewQueue.queryKey(reviewQueueInput),
                    exact: true
                });
                await queryClient.invalidateQueries({
                    queryKey: trpc.forum.forumReplyReviewQueue.queryKey(reviewQueueInput),
                    exact: true
                });
            }
        })
    )

    const banUserMutation = useMutation(
        trpc.forum.userForumBan.mutationOptions({
            onMutate: () => {
                setMutationError(null);
                setIsForumMutationHappening(true);
            },
            onError: (err) => {
                setMutationError(getErrorMessage(err));
            },
            onSettled: async (_data, _error) => {
                setIsForumMutationHappening(false);
                await queryClient.invalidateQueries({
                    queryKey: trpc.forum.forumReviewQueue.queryKey(reviewQueueInput),
                    exact: true
                });
                await queryClient.invalidateQueries({
                    queryKey: trpc.forum.forumReplyReviewQueue.queryKey(reviewQueueInput),
                    exact: true
                });
            }
        })
    )

    const approvePostMutation = useMutation(
        trpc.forum.forumReviewApprove.mutationOptions({
            onMutate: () => {
                setMutationError(null);
                setIsForumMutationHappening(true);
            },
            onError: (err) => {
                setMutationError(getErrorMessage(err));
            },
            onSettled: async (_data, _error) => {
                setIsForumMutationHappening(false);
                await queryClient.invalidateQueries({
                    queryKey: trpc.forum.forumReviewQueue.queryKey(reviewQueueInput),
                    exact: true
                });
                await queryClient.invalidateQueries({
                    queryKey: trpc.forum.forumReplyReviewQueue.queryKey(reviewQueueInput),
                    exact: true
                });
            }
        })
    )

    return (
        <div className='flex flex-col items-center justify-center w-full p-0 m-0'>
            <h1 className="scale-150 text-xl font-bold">Forum</h1>
            {reviewQueueError && (
                <p className="mt-6 w-full max-w rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
                    {getErrorMessage(reviewQueueError, 'errors.api.reviewQueueLoad')}
                </p>
            )}
            {mutationError && (
                <p className="mt-6 w-full max-w rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
                    {mutationError}
                </p>
            )}
            <h2 className="w-full max-w text-lg font-semibold mt-8 mb-2">Pending Posts</h2>
            <ListContainer className="w-full max-w">
                {forumPosts?.map((post) => (
                    <ListItem adminColors={true} image={getSubjectBySlug(post.subject as TaalSlugEnum)?.icon} key={post.id} linkTo={`/app/forum/${post.id}`} title={post.title} subtitle={`By ${post.author.name} on ${new Date(post.createdAt).toLocaleDateString()}`}>
                        <div className="flex flex-row flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                            <Button variant="secondary" onClick={() => { banUserMutation.mutate({ userId: post.author.id, ban: true }) }} disabled={isForumMutationHappening}>Forum ban</Button>
                            <Button variant="secondary" onClick={() => { deletePostMutation.mutate({ type: "POST", id: post.id }) }} disabled={isForumMutationHappening}>Remove</Button>
                            <Button variant="secondary" onClick={() => { approvePostMutation.mutate({ type: "POST", id: post.id }) }} disabled={isForumMutationHappening}>Approve</Button>
                        </div>
                    </ListItem>
                ))}
            </ListContainer>
            <h2 className="w-full max-w text-lg font-semibold mt-8 mb-2">Pending Replies</h2>
            <ListContainer className="w-full max-w">
                {forumReplies?.map((reply) => (
                    <ListItem
                        adminColors={true}
                        key={reply.id}
                        linkTo={`/app/forum/${reply.post.id}`}
                        title={reply.content.length > 80 ? `${reply.content.slice(0, 80)}...` : reply.content}
                        subtitle={`By ${reply.author.name} on ${new Date(reply.createdAt).toLocaleDateString()} in ${reply.post.title}`}
                    >
                        <div className="flex flex-row flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                            <Button variant="secondary" onClick={() => { banUserMutation.mutate({ userId: reply.author.id, ban: true }) }} disabled={isForumMutationHappening}>Forum ban</Button>
                            <Button variant="secondary" onClick={() => { deletePostMutation.mutate({ type: "REPLY", id: reply.id }) }} disabled={isForumMutationHappening}>Remove</Button>
                            <Button variant="secondary" onClick={() => { approvePostMutation.mutate({ type: "REPLY", id: reply.id }) }} disabled={isForumMutationHappening}>Approve</Button>
                        </div>
                    </ListItem>
                ))}
            </ListContainer>
        </div>
    )
}
