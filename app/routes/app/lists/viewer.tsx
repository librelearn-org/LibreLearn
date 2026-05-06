import { caller } from "~/utils/trpc/server.server";
import type { Route } from "./+types/viewer";
import { LearnListItems, ListItem } from "~/components/list/list";
import { getSubjectBySlug } from "~/components/Icons";
import { Button } from "~/components/button/button";
import { Pencil } from "lucide-react";
import { useNavigate } from "react-router";

export async function loader(loaderArgs: Route.LoaderArgs) {
    const api = await caller(loaderArgs);
    if (!loaderArgs.params.listId) {
        throw new Response("Not Found", { status: 404 });
    }
    const list = await api.learn.getList({ id: loaderArgs.params.listId! });
    if (!list) {
        throw new Response("Not Found", { status: 404 });
    }
    const user = await api.user.user();
    return {
        ...list,
        userId: user?.id,
        admin: user?.role === "admin"
    };
}

export default function Component({ loaderData }: Route.ComponentProps) {
    const nav = useNavigate();
    return (
        <div>
            <ListItem title={loaderData.name} subtitle={loaderData.listItems.length + " items ・ by " + loaderData.owner.name} image={getSubjectBySlug(loaderData.language)?.icon} className="mx-4">
                {((loaderData.userId === loaderData.ownerId) || loaderData.admin) &&
                    <Button onClick={() => { nav("/app/list/new/" + loaderData.id) }}><Pencil /></Button>
                }
            </ListItem>
            <Button onClick={() => { nav("/app/learn/" + loaderData.id + "/testing") }}>TEST</Button>
            <LearnListItems data={loaderData.listItems.map((value) => { return { from: value.vraag, to: value.antwoord } })} />
        </div>
    );
}