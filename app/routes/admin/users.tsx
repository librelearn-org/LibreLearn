import { redirect, useNavigate } from "react-router";
import { caller } from '~/utils/trpc/server.server'
import type { Route } from "./+types/users";
import { useTRPC } from "~/utils/trpc/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "~/components/button/button";

export async function loader(loaderArgs: Route.LoaderArgs) {
  const api = await caller(loaderArgs);
  const users = await api.admin.getAllUsers();
  return users
}

export default function Home({ loaderData: users }: Route.ComponentProps) {
  const trpc = useTRPC();
  const redirect = useNavigate()
  const { data, fetchNextPage, isFetching, isLoading } = useInfiniteQuery({
    queryKey: trpc.admin.getAllUsers.queryKey(),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchOnWindowFocus: false,
    initialData: {
      pages: [users],
      pageParams: [null],
    },
  })

  return (<div className="p-4 flex flex-col gap-4 justify-center items-center text-center">
    <h1 className="text-2xl font-bold">Users</h1>
    <div className="w-full max-w-md flex flex-col gap-2 text-left">
    <table className="w-full">
      <thead>
        <tr>
          <th className="p-4 text-left">Name</th>
          <th className="p-4 text-left">Email</th>
          <th className="p-4 text-left">Banned?</th>
        </tr>
      </thead>
      <tbody>
        {data?.pages.map((page) => (
          page.users.map((user) => (
            <tr
              key={user.id}
              className="bg-admin-800 cursor-pointer"
              onClick={() => { redirect("/admin/users/" + user.id) }}
            >
              <td className="p-4">{user.name}</td>
              <td className="p-4">{user.email}</td>
              <td className="p-4">{user.banned}</td>
            </tr>
          ))
        ))}
      </tbody>
    </table>
    </div>
    <Button onClick={() => fetchNextPage()} disabled={isFetching || isLoading}>
      Load More
    </Button>
  </div>
  )
}