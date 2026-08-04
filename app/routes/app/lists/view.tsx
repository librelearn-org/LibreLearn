import type { Route } from "./+types/view";
import { authClient } from "~/utils/auth/client";
import { redirect, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Button, Card, classNames, Flex, List, menuHelper, Progress, Space, SplitButton } from "@siemsiem/beerreact";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "~/utils/trpc/client";
import { useTRPC } from "~/utils/trpc/react";
import { getSubjectBySlug } from "~/components/Icons";

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

            <Card>
                {list.isPending ? <Progress></Progress> : ""}
                <nav className="m l">
                    <h1 className="max">{list.data?.name}</h1>
                    <Button icon="edit" shape={"circle"} onClick={() => { navigate("/app/lists/edit/" + list.data?.id) }}></Button>
                    <Button icon="delete" shape={"circle"} onClick={() => { navigate("/app/lists/edit/" + list.data?.id) }}></Button>
                </nav>
                <h1 className="s">{list.data?.name}</h1>
                <h5 style={{ marginTop: "0" }} className={classNames.text.inlineSize.large}>
                    <nav className={"no-space"}>
                        <img src={getSubjectBySlug(list.data?.fromLanguage || "??")?.icon} style={{ height: "1.5em" }} />
                        <i>arrow_right_alt</i>
                        <img src={getSubjectBySlug(list.data?.toLanguage || "??")?.icon} style={{ height: "1.5em" }} />
                        <p >・{list.data?.listItems.length} Woorden</p>
                    </nav>
                </h5>
                <Space />
                <nav className="scroll">
                    <SplitButton menu={menuHelper({ menuData: [] })}>Leren</SplitButton>
                    <Button className="s" icon="edit" onClick={() => { navigate("/app/lists/edit/" + list.data?.id) }}>Bewerken</Button>
                    <Button className="s" icon="delete" onClick={() => { navigate("/app/lists/edit/" + list.data?.id) }}>Verwijderen</Button>
                </nav>
            </Card>

            <Card>
                <table className={`stripes center-align`}>
                    <thead>
                        <tr>
                            <th>Van</th>
                            <th>Naar</th>
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

