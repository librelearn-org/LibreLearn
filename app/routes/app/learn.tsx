import type { Route } from "./+types/learn";
import "../admin/admin.css"
import { caller } from "~/utils/trpc/server.server";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/utils/trpc/react";
import { use, useEffect, useMemo, useState } from "react";
import learnLib from "@siemsiem/learnlib";
import { Button } from "~/components/button/button";
import "~/components/text-field/text-field.css";


export async function loader(loaderArgs: Route.LoaderArgs) {
    // const uuid = loaderArgs.params.listId;
    // const api = await caller(loaderArgs);
    // const session = await api.learn.getLearnSession(uuid);
    // if (session) {
    //     console.log("session", session);
    //     return session;
    // }
    // // we hebben geen learn session maaar voor we er van uit gaan checken we op we een session aan het maken zijn
    // const list = await api.learn.getList({ id: uuid });
    // console.log("list", list);
    // if (!list) {
    //     throw new Response("Not Found", { status: 404 });
    // }

    // const newSession = api.learn.startLearnSession({ listId: uuid });
    // return newSession;
}

export default function Learn({ loaderData: sessionBASE }: Route.ComponentProps) {
    //     const trpc = useTRPC();
    //     const updateSessionCloud = useMutation({
    //         ...trpc.learn.updateLearnSessionItem.mutationOptions(),
    //         onSuccess() {
    //             console.log("yipie! sync at " + new Date().toISOString());
    //         }
    //     });
    //     const [userAnswer, setUserAnswer] = useState("");
    //     const learnTool = useMemo(
    //         () => new learnLib(sessionBASE!.listSessionItems),
    //         [sessionBASE]
    //     );
    //     const [state, setState] = useState(learnTool.getState());

    //     useEffect(() => {
    //         learnTool.setSubscriber(setState);
    //     }, [learnTool]);

    //     useEffect(() => {
    //         if (state.last == "") return;
    //         const currentItem = state.lijst[state.last];
    //         const currentItemHistory = currentItem.listSessionItemAnswerHistories![currentItem.listSessionItemAnswerHistories!.length - 1];
    //         updateSessionCloud.mutate({
    //             listSessionIdItem: state.lijst[state.last].id || "",
    //             goed: currentItemHistory.goed,
    //             round: currentItemHistory.round,
    //             antwoord: currentItemHistory.antwoord,
    //         });
    //     }, [state.last]);

    //     return (
    //         <div>
    //             <div className="p-4 m-4 flex flex-col justify-center items-center">
    //                 <div className="bg-librelearn-800 p-4 rounded-lg w-sm justify-center items-center flex flex-col text-center">
    //                     {state.wachtrij.length === 0 ? (
    //                         <>
    //                             <p>Je hebt alles geleerd! Gefeliciteerd!</p>
    //                             <Button
    //                                 onClick={() => window.location.reload()}
    //                                 variant="secondary"
    //                             >Opnieuw leren</Button>
    //                         </>
    //                     ) : (
    //                         <>
    //                             <p className="text-2xl mb-4">{state.lijst[state.wachtrij[0]].vraag}</p>
    //                             <input
    //                                 type="text"
    //                                 value={userAnswer}
    //                                 onChange={(e) => setUserAnswer(e.target.value)}
    //                                 className="border p-2 rounded mb-4 w-full"
    //                             />
    //                             <Button
    //                                 onClick={() => {
    //                                     learnTool.answer(userAnswer);
    //                                     setUserAnswer("");
    //                                 }}
    //                                 variant="secondary"
    //                             >
    //                                 Antwoord
    //                             </Button>
    //                         </>

    //                     )}
    //                 </div>
    //             </div>
    //         </div>
    //     );
    // }
    return (
        <p>geef me like een dag of 2</p>
    )
}