// TODO: dit maken!!
import { redirect } from "react-router";
import type { Route } from "./+types/userview";
import { caller } from '~/utils/trpc/server.server'
import { ListContainer, ListItem } from "~/components/list/list";
import { getSubjectBySlug } from "~/components/Icons";
import { useTRPC } from "~/utils/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/button/button";
import config from "~/utils/config";
import { useState } from "react";
import { getErrorMessage } from "~/utils/error-message";


export async function loader(loaderArgs: Route.LoaderArgs) {
    const userId = loaderArgs.params.userId;
    if (!userId) {
        throw new Response("User ID is required", { status: 400 });
        return redirect("/admin/users");
    }
    const api = await caller(loaderArgs);

    const user = await api.admin.getUserProfile(userId);
    if (!user) {
        throw new Response("User not found", { status: 404 });
        return redirect("/admin/users");
    }
    return user
}

export default function Home({ loaderData: userBASE }: Route.ComponentProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient()
    const [isForumMutationHappening, setIsForumMutationHappening] = useState(false)
    const [mutationError, setMutationError] = useState<undefined | string>(undefined)
    const [visibleForumPosts, setVisibleForumPosts] = useState(5)
    const [visibleForumPostsR, setVisibleForumPostsR] = useState(5)

    const { data: user, isLoading, error } = useQuery(trpc.admin.getUserProfile.queryOptions(
        userBASE.id, {
        initialData: userBASE,
        staleTime: config.refetchTime,
        refetchInterval: config.refetchTime,
        refetchIntervalInBackground: config.refetch
    }))

    const removeForumPost = useMutation(
        trpc.forum.deleteItem.mutationOptions({
            onMutate: () => {
                setIsForumMutationHappening(true);
            },
            onError: (err) => {
                setMutationError(getErrorMessage(err));
            },
            onSettled: async (_data, _error) => {
                setIsForumMutationHappening(false);
                await queryClient.invalidateQueries({
                    queryKey: trpc.admin.getUserProfile.queryKey(userBASE.id),
                    exact: true
                });
            }
        })
    )
    const forumBan = useMutation(
        trpc.forum.userForumBan.mutationOptions({
            onMutate: () => {
                setIsForumMutationHappening(true);
            },
            onError: (err) => {
                setMutationError(getErrorMessage(err));
            },
            onSettled: async (_data, _error) => {
                setIsForumMutationHappening(false);
                await queryClient.invalidateQueries({
                    queryKey: trpc.admin.getUserProfile.queryKey(userBASE.id),
                    exact: true
                });
            }
        })
    )
    const ban = useMutation(
        trpc.forum.userForumBan.mutationOptions({
            onMutate: () => {
                setIsForumMutationHappening(true);
            },
            onError: (err) => {
                setMutationError(getErrorMessage(err));
            },
            onSettled: async (_data, _error) => {
                setIsForumMutationHappening(false);
                await queryClient.invalidateQueries({
                    queryKey: trpc.admin.getUserProfile.queryKey(userBASE.id),
                    exact: true
                });
            }
        })
    )

    return (
        <div className="p-3">
            <h1 className="text-2xl font-bold">General</h1>
            name: {user.name} <br />
            mail: {user.email} <br />
            role: {user.role}<br />
            {!user.banned && <p style={{ color: "green" }}>Not banned</p>}
            {user.banned && <p style={{ color: "red" }}>Banned</p>}
            {user.forumBanned && <p style={{ color: "red" }}>Forum banned</p>}
            {user.banReason && <p style={{ color: "red" }}>Banned reason: {user.banReason}</p>}
            {user.banExpires && <p style={{ color: "red" }}>Ban expires at: {new Date(user.banExpires).toLocaleString()}</p>}
            id: {user.id}
            {user.accounts.map((account) => (
                <p key={account.id}>
                    sign in with: {account.providerId}
                </p>
            ))}

            <Button onClick={() => {
                forumBan.mutate({
                    userId: userBASE.id,
                    ban: !(user.banned),
                    banFull: true
                })
            }} variant="secondary">
                Ban/Unban
            </Button>

            <Button onClick={() => {
                forumBan.mutate({
                    userId: userBASE.id,
                    ban: !(user.forumBanned)
                })
            }} variant="secondary">
                Forum ban/unban
            </Button>
            {user.forumPosts.length != 0 ? (
                <>
                    <h1 className="text-2xl font-bold">Forum posts</h1>
                    <ListContainer>
                        {user.forumPosts.slice(0, visibleForumPosts).map((post) => (
                            <ListItem title={post.title} adminColors={true} subtitle={post.content} image={getSubjectBySlug(post.subject)?.icon} linkTo={`/app/forum/${post.id}`}>
                                <Button variant="secondary" onClick={() => { removeForumPost.mutate({ type: "POST", id: post.id }) }}>
                                    Delete
                                </Button>
                            </ListItem>
                        ))}
                    </ListContainer>
                    {visibleForumPosts < user.forumPosts.length && (
                        <Button variant="secondary" onClick={() => setVisibleForumPosts((current) => current + 5)}>
                            Load more
                        </Button>
                    )}
                </>
            ) : undefined}

            {user.forumPostReplies.length != 0 ? (
                <>
                    <h1 className="text-2xl font-bold">Forum Replies</h1>
                    <ListContainer>
                        {user.forumPostReplies.slice(0, visibleForumPostsR).map((post) => (
                            <ListItem title={post.content} adminColors={true} subtitle={post.content} linkTo={`/app/forum/${post.id}`}>
                                <Button variant="secondary" onClick={() => { removeForumPost.mutate({ type: "REPLY", id: post.id }) }}>
                                    Delete
                                </Button>
                            </ListItem>
                        ))}
                    </ListContainer>
                    {visibleForumPosts < user.forumPosts.length && (
                        <Button variant="secondary" onClick={() => setVisibleForumPostsR((current) => current + 5)}>
                            Load more
                        </Button>
                    )}
                </>
            ) : undefined}
        </div>
    )
}
