import type { Route } from "./+types/list";
import { caller } from '~/utils/trpc/server.server'
import { useNavigate } from "react-router";
import { auth } from '~/utils/auth/server.server'
import { Button } from "~/components/button/button";
import { ListContainer, ListItem } from "~/components/list/list";
import { getSubjectBySlug, TaalSlugEnum } from "~/components/Icons";
import { Plus, Trash } from "lucide-react";
import { useTRPC } from '~/utils/trpc/react'
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import config from "~/utils/config";
import { getErrorMessage } from "~/utils/error-message";

export async function loader(loaderArgs: Route.LoaderArgs) {
  const api = await caller(loaderArgs);
  const headers = new Headers(loaderArgs.request.headers)
  const result = await auth.api.getSession({ headers })
  const user = result?.user
  const forumPosts = await api.forum.getPosts({});
  return { forum: forumPosts, user: user };
}

export default function ForumHome({ loaderData: { forum: forumPosts, user: user } }: Route.ComponentProps) {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const getPostsInput = {};


  const { data: forum, isLoading, error } = useQuery(
    trpc.forum.getPosts.queryOptions(getPostsInput, {
      initialData: forumPosts,
      staleTime: config.refetchTime,
      refetchInterval: config.refetchTime,
      refetchIntervalInBackground: config.refetch
    })
  )
  const forumErrorMessage = error ? getErrorMessage(error, "errors.api.forumLoad") : null;


  const [isForumMutationHappening, setIsForumMutationHappening] = useState(false);

  const deletePostMutation = useMutation(
    trpc.forum.deleteItem.mutationOptions({
      onMutate: () => {
        setIsForumMutationHappening(true);
      },
      onSettled: async (_data, _error) => {
        setIsForumMutationHappening(false);
        await queryClient.invalidateQueries({
          queryKey: trpc.forum.getPosts.queryKey(getPostsInput),
          exact: true
        });
      }
    })
  )

  return (
    <div className='flex flex-col items-center justify-center w-full p-0 m-0 mt-0'>
      <div className="w-full max-w flex flex-row items-center justify-between p-5">
        <h1 className="p-5 text-4xl font-bold">Forum</h1>

        <Button onClick={() => navigate('/app/forum/make')}>
          <Plus />
        </Button>
      </div>
      {isLoading && <p>Loading...</p>}
      {forumErrorMessage && (
        <p className="mx-5 w-full max-w rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          {forumErrorMessage}
        </p>
      )}
      <ListContainer className="w-full max-w ">
        {forum?.map((post) => (
          <ListItem
            className="mx-5"
            image={getSubjectBySlug(post.subject as TaalSlugEnum)?.icon} 
            key={post.id}
            linkTo={`/app/forum/${post.id}`} 
            title={post.title}
            subtitle={`By ${post.author.name} on ${new Date(post.createdAt).toLocaleDateString()}`}
          >
            {((user?.id || "this is not a valid uuid") === post.authorId || user?.role == "admin") && (
              <Button onClick={() => { deletePostMutation.mutate({ type: "POST", id: post.id }) }} disabled={isForumMutationHappening} variant="secondary"><Trash /></Button>
            )}
          </ListItem>
        ))}
      </ListContainer>
    </div>
  )
}