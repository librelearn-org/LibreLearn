import type { Route } from "./+types/view";
import { authClient } from "~/utils/auth/client";
import { redirect, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Button, Progress } from "@siemsiem/beerreact";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "~/utils/trpc/client";
import { useTRPC } from "~/utils/trpc/react";

export default function view({ params }: Route.ComponentProps) {
    const { listId } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const trpc = useTRPC();

    const list = useQuery(
        trpc.learn.getList.queryOptions(
            { id: listId || params.listId },
            { enabled: !!(listId || params.listId) }
        )
    );

    return (
        <div>
            {list.isPending ? <Progress></Progress> : ""}
            {JSON.stringify(list.data)}
            <h1>{list.data?.name}</h1>
            <Button icon="edit" shape={"circle"} onClick={() => { navigate("/app/lists/edit/" + list.data?.id) }}></Button>
        </div>
    );
}

