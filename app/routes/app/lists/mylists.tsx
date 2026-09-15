import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { List, Progress } from "@siemsiem/beerreact";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trpcClient } from "~/utils/trpc/client";
import { useTRPC } from "~/utils/trpc/react";
import { getSubjectBySlug } from "~/components/Icons";

export default function Mylists() {
  const { t } = useTranslation();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const lists = useQuery(
    trpc.learn.getUserLists.queryOptions(undefined, {
      // configs hier.....
    }),
  );

  return (
    <div>
      <h4>{t("lists:myLists")}</h4>

      {lists.isPending ? <Progress></Progress> : ""}

      <List>
        {lists.data?.map((v) => {
          const handlePreload = () => {
            queryClient.prefetchQuery(
              trpc.learn.getList.queryOptions({ id: v.id }),
            );
          };

          return (
            <li key={v.id}>
              <Link
                to={"/app/lists/" + v.id}
                onMouseEnter={handlePreload}
                onFocus={handlePreload}
                onTouchStart={handlePreload}
              >
                <img
                  className="round"
                  src={getSubjectBySlug(v.toLanguage)?.icon}
                />
                <div className="max">
                  <h6>{v.name}</h6>
                  <div>
                    {v.listItems.length} {t("lists:words")}
                  </div>
                </div>
                <i>chevron_right</i>
              </Link>
            </li>
          );
        })}
      </List>
    </div>
  );
}
