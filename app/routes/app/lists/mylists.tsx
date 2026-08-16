import type { Route } from "./+types/mylists";
import { authClient } from "~/utils/auth/client";
import { redirect, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button, Progress } from "@siemsiem/beerreact";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trpcClient } from "~/utils/trpc/client";
import { useTRPC } from "~/utils/trpc/react";
import { useMemo } from "react";


export default function Mylists({ loaderData: user }: Route.ComponentProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const lists = useQuery(trpc.learn.getUserLists.queryOptions(undefined, {
        // configs hier.....
    }));

    return (
        <div>

            <h4>{t("lists:myLists")}</h4>

            {lists.isPending ? <Progress></Progress> : ""}

            {lists.data?.map((v) => {
                const handlePreload = () => {
                    queryClient.prefetchQuery(trpc.learn.getList.queryOptions({ id: v.id }));
                };

                return (
                    <Button
                        key={v.id}
                        variant="transparent"
                        responsive={true}
                        onClick={() => {
                            navigate("/app/lists/" + v.id);
                        }}
                        onMouseEnter={handlePreload}
                        onFocus={handlePreload}
                        onTouchStart={handlePreload}
                    >
                        {v.name}
                    </Button>
                );
            })}
        </div>
    );
}

