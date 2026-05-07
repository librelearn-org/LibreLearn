import type { Route } from "./+types/learn";
import "../admin/admin.css"
import { caller } from "~/utils/trpc/server.server";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/utils/trpc/react";
import { useEffect, useMemo, useState } from "react";
import learnLibReact from "~/components/learnlib";
import { Button } from "~/components/button/button";

export async function loader(loaderArgs: Route.LoaderArgs) {
    const uuid = loaderArgs.params.listId;
    const api = await caller(loaderArgs);
    const session = await api.learn.getLearnSession(uuid);
    if (session) {
        console.log("session", session);
        return session;
    }
    // we hebben geen learn session maaar voor we er van uit gaan checken we op we een session aan het maken zijn
    const list = await api.learn.getList({ id: uuid });
    console.log("list", list);
    if (!list) {
        throw new Response("Not Found", { status: 404 });
    }

    const newSession = api.learn.startLearnSession({ listId: uuid });
    return newSession;
}

export default function Learn({ loaderData: sessionBASE }: Route.ComponentProps) {
    const trpc = useTRPC();
    const updateSession = useMutation({
        ...trpc.learn.updateLearnSessionItem.mutationOptions(),
        onSuccess() {
            console.log("yipie! sync at " + new Date().toISOString());
        }
    });
    const learnTool = useMemo(
        () => new learnLibReact(sessionBASE!.listSessionItems),
        [sessionBASE]
    );
    const [state, setState] = useState(learnTool.getState());

    useEffect(() => {
        learnTool.setStateUpdater(setState);
    }, [learnTool]);


    return (
        <div>
            {state.wachtrij.length === 0 ? (
                <p>Je hebt alles geleerd! Gefeliciteerd!</p>
            ) : (

                <>
                    <h1>Learn</h1>
                    <p>{state.lijst[state.wachtrij[0]].vraag}</p>
                    <p>{state.lijst[state.wachtrij[0]].antwoord}</p>
                    <Button onClick={() => learnTool.antwoord(state.lijst[state.wachtrij[0]].antwoord, true)}>Goed Antwoord</Button>
                    <Button onClick={() => learnTool.antwoord("aygefuyogaeywgu", false)}>Fout Antwoord</Button>

                    <Button onClick={() => learnTool.reshuffle()}>Reshuffle</Button>
                </>
            )}
        </div>
    );
}