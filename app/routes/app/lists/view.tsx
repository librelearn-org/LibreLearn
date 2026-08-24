import type { Route } from "./+types/view";
import { redirect, useNavigate, useParams, useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { Button, Card, classNames, Flex, List, menuHelper, Progress, Space, SplitButton, useDialog, useToast } from "@siemsiem/beerreact";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpcClient } from "~/utils/trpc/client";
import { useTRPC } from "~/utils/trpc/react";
import { getSubjectBySlug } from "~/components/Icons";

export default function view({ params }: Route.ComponentProps) {
    const user = useOutletContext<any>();
    const { listId } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const trpc = useTRPC();
    const { addToast } = useToast();
    const queryClient = useQueryClient();

    const list = useQuery(
        trpc.learn.getList.queryOptions(
            { id: listId || params.listId },
            { enabled: !!(listId || params.listId) }
        )
    );

    const startSession = useMutation({
        ...trpc.learn.upsertLearnSession.mutationOptions(),
        onSuccess(session) {
            navigate(`/app/learn/${session.id}`);
        },
        onError(error) {
            addToast({
                text: error.message,
                type: "error"
            });
        }
    });

    const handleStartLearn = () => {
        if (!list.data) return;
        navigate("/app/sessionstart/" + list.data.id)
    };

    const verwijder = useMutation({

        ...trpc.learn.removeList.mutationOptions(),
        onSuccess(data, variables, onMutateResult, context) {
            queryClient.invalidateQueries(trpc.learn.getList.queryFilter({ id: listId }));
            queryClient.invalidateQueries(trpc.learn.getUserLists.queryFilter());
            addToast({
                text: "Gelukt!"
            });
            navigate("/app/lists/mylists");
        },
        onError(error, variables, onMutateResult, context) {
            addToast({
                text: error.message,
                type: "error"
            });
        },

    })
    const { pushDialog } = useDialog()

    function vwDialog() {
        pushDialog({
            content: <>
                <h2>Weet je het zeker</h2>
                <p>Je kan een verwijderde lijst niet herstellen!</p>
                <nav className="right-align">
                    <Button>WACHT NEE TERUG</Button>
                    <Button onClick={() => { verwijder.mutate({ id: list.data?.id || listId || params.listId }) }}>Ja!</Button>
                </nav>

            </>,
            // pos: "left" // TODO: een pos geven op mobile
        })
    }



    return (
        <div>

            <Card>
                {list.isPending ? <Progress></Progress> : ""}
                <nav className="m l">
                    <h1 className="max">{list.data?.name}</h1>
                    {((user.id === list.data?.ownerId) || (user.role === "admin")) && <>
                        <Button icon="edit" shape={"circle"} onClick={() => { navigate("/app/lists/edit/" + list.data?.id) }}></Button>
                        <Button icon="delete" shape={"circle"} onClick={vwDialog}></Button>
                    </>}
                    {/* <Button icon="bug_report" shape={"circle"} onClick={() => { alert(JSON.stringify(list.data)) }}></Button> */}
                </nav>
                <h1 className="s">{list.data?.name}</h1>
                <h5 style={{ marginTop: "0" }} className={classNames.text.inlineSize.large}>
                    <nav className={"no-space"}>
                        <p >{list.data?.listItems.length} {t("lists:words")}</p>
                    </nav>
                </h5>
                <Space />
                <nav className="scroll">
                    <SplitButton menu={menuHelper({ menuData: [] })} disabled={startSession.isPending || !list.data?.listItems.length} onClick={handleStartLearn}>{t("learn:learnBtn")}</SplitButton>
                    {((user.id === list.data?.ownerId) || (user.role === "admin")) && <>
                        <Button className="s" icon="edit" onClick={() => { navigate("/app/lists/edit/" + list.data?.id) }}>{t("lists:edit:edit")}</Button>
                        <Button className="s" icon="delete" onClick={vwDialog}>{t("lists:edit:delete")}</Button>
                    </>}
                </nav>
            </Card>

            <Card>
                <table className={`stripes center-align`}>
                    <thead>
                        <tr>
                            <th>
                                <nav className="vertical no-space center-align">

                                    <img src={getSubjectBySlug(list.data?.fromLanguage || "??")?.icon} style={{ height: "1.5em" }} />
                                    {t("icons:from")}
                                </nav>
                            </th>
                            <th>
                                <nav className="vertical no-space center-align">

                                    <img src={getSubjectBySlug(list.data?.toLanguage || "??")?.icon} style={{ height: "1.5em" }} />
                                    {t("icons:to")}
                                </nav>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.data?.listItems.map((v) => {
                            return <tr key={v.id}>
                                <td>{v.vraag}</td>
                                <td>{v.antwoord}</td>
                            </tr>
                        })}
                    </tbody>
                </table>
            </Card>
            {/* {JSON.stringify(list.data)} */}

            <List>
            </List>
        </div>
    );
}

