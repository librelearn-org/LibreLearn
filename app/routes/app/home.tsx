import { Link, useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { Button, List, Progress, Space } from "@siemsiem/beerreact";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Logo } from "~/components/Logo";
import { getSubjectBySlug } from "~/components/Icons";
import { useTRPC } from "~/utils/trpc/react";

export default function Home() {
  const user = useOutletContext<any>();
  const { t } = useTranslation();
  const trpc = useTRPC();
  const openSessions = useQuery(trpc.learn.getUserLearnSessions.queryOptions());
  const queryClient = useQueryClient()
  const prugeAll = useMutation({
    ...trpc.learn.removeAllUserLearnSessiosn.mutationOptions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: trpc.learn.getUserLearnSessions.queryKey(),
      });
      queryClient.invalidateQueries(trpc.learn.getUserLists.queryFilter());
    },
  });
  const firstName = user?.name?.split(" ")[0] ?? "";
  const greeting =
    new Date().getHours() < 18
      ? t("startPage:greetingMorning", { name: firstName })
      : t("startPage:greetingEvening", { name: firstName });

  return (
    <div>
      <div>
        <div>
          <h1>
            {greeting}{" "}
            <Logo style={{ height: "1em", margin: "0", padding: "-10em" }} />
          </h1>

          <p>{t("startPage:description")}</p>

          <section style={{ marginTop: "2rem" }}>
            <nav>

              <h4>{t("startPage:openSessions")}</h4>
              <div className="max"></div>
              <Button onClick={() => { prugeAll.mutate() }} icon="delete">Purge</Button>
            </nav>

            {openSessions.isPending ? (
              <Progress />
            ) : openSessions.data?.length ? (
              <List>
                {openSessions.data.map((session) => {
                  const subjectIcon = session.list?.toLanguage
                    ? getSubjectBySlug(session.list.toLanguage)?.icon
                    : undefined;

                  return (
                    <li key={session.id}>
                      <Link to={`/app/learn/${session.id}?type=session`}>
                        {subjectIcon ? (
                          <img className="round" src={subjectIcon} />
                        ) : (
                          <i>school</i>
                        )}
                        <div className="max">
                          <div className="large-text">
                            {session.list?.name ??
                              t("startPage:unnamedSession")}
                          </div>
                          <div className="on-surface-variant small-text">
                            {session.learnFormat} •{" "}
                            {t("startPage:itemsRemaining", {
                              count: session._count.wachtrij,
                            })}
                          </div>
                        </div>
                        <i>chevron_right</i>
                      </Link>
                    </li>
                  );
                })}
              </List>
            ) : (
              <p>{t("startPage:noOpenSessions")}</p>
            )}
          </section>

          <details style={{ marginTop: "1.5rem" }}>
            <summary>Meer info</summary>
            <p>{JSON.stringify(user)}</p>
          </details>
        </div>
      </div>
    </div>
  );
}
