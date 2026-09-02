import type { Route } from "./+types/learn";
import { data, useSearchParams } from "react-router";
import { Button, Card, Code, Input, Space, classNames, useDialog } from "@siemsiem/beerreact";
import { trpcClient } from "~/utils/trpc/client";
import { useEffect, useMemo, useRef, useState } from "react";
import Learnlib, { gradeMakers, methodes, wachtrijUpdaters, type LearnlibState } from "@siemsiem/learnlib";
import { learnFormat } from "../../../generated/prisma/enums";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
    const id = params.id;

    let sessionData: Awaited<ReturnType<typeof trpcClient.learn.getLearnSession.query>> | null = null;
    let error: string | null = null;

    if (!id) {
        return { id: null, sessionData: null, error: "Geen ID opgegeven" };
    }

    try {
        sessionData = await trpcClient.learn.getLearnSession.query({ id });
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Fout bij het ophalen van de leersessie";
    }

    return {
        id,
        sessionData,
        error
    };
}

declare module "@siemsiem/beerreact" {
    interface InputProps {
        ref?: React.Ref<HTMLInputElement>;
    }
}

export default function LearnPage({ loaderData }: Route.ComponentProps) {
    const [searchParams] = useSearchParams();
    const { pushDialog } = useDialog();
    const veld = useRef<HTMLInputElement>(null);
    const [resetKey, setResetKey] = useState(0);
    const sessionId = loaderData.sessionData?.id;
    const rawWachtrij = loaderData.sessionData?.wachtrij;

    const lib = useMemo(() => {
        if (rawWachtrij) {
            return new Learnlib(rawWachtrij, methodes[0], gradeMakers[0], wachtrijUpdaters[0])
        }
    }, [rawWachtrij, resetKey]);

    const [state, setState] = useState<LearnlibState | null>(() => lib?.getSnapshot() ?? null);

    useEffect(() => {
        if (!lib) return;
        setState(lib.getSnapshot());
        return lib.subscribe(setState);
    }, [lib]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!lib || !veld.current) return;
        const antwoordVal = veld.current.value;
        lib.antwoord(antwoordVal);
        veld.current.value = "";
    };

    const dbg = () => {
        pushDialog({
            content: debugPopup({ loaderData }, lib, veld.current !== null),
            pos: 'left'
        });
    };

    return (
        <>
            <div className="center middle absolute">
                <Card style={{ minWidth: "320px", maxWidth: "500px" }}>
                    {loaderData.error ? (
                        <div className="center-align padding">
                            <p style={{ color: "red" }}>{loaderData.error}</p>
                        </div>
                    ) : !lib || !state ? (
                        <div className="center-align padding">
                            <p>Geen items gevonden om te leren.</p>
                        </div>
                    ) : state.isKlaar ? (
                        <div className="center-align padding">
                            <i className="extra">check_circle</i>
                            <h2>Gefeliciteerd!</h2>
                            <p>Je hebt alle woorden in deze sessie geleerd!</p>
                            <Space />
                            <Button onClick={() => setResetKey((k) => k + 1)} icon="refresh">
                                Opnieuw Leren
                            </Button>
                        </div>
                    ) : loaderData.sessionData?.learnFormat !== learnFormat.toets ? (
                        <div className="center-align padding">
                            <p style={{ color: "red" }}>Aleen toets werkt voor nu</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <nav className="vertical center-align">
                                <div style={{ width: "100%", textAlign: "right", fontSize: "0.85rem", opacity: 0.7 }}>
                                    Wachtrij: {state.wachtrij.length} / {state.initialCount}
                                </div>
                                <h3 className={classNames.text.bold}>{state.current?.vraag}</h3>
                                <Input ref={veld} placeholder="Typ je antwoord..."></Input>
                                <Space />
                                <Button type="submit">
                                    Antwoord
                                </Button>
                            </nav>
                        </form>
                    )}
                </Card>
            </div>

            <Button onClick={dbg} icon="bug_report" shape="circle"></Button>
        </>
    );
}

function debugPopup(
    { loaderData }: { loaderData: Route.ComponentProps["loaderData"] },
    lib: Learnlib | null | undefined,
    inputFound: boolean,
) {
    return (
        <>
            <nav className="row items-center">
                <h2 className="max">Leersessie</h2>
            </nav>

            <p><strong>ID:</strong> <code>{loaderData.id}</code></p>

            {loaderData.error && (
                <div style={{ color: "red", marginTop: "1rem" }}>
                    <p><strong>Fout:</strong> {loaderData.error}</p>
                </div>
            )}

            {loaderData.sessionData && (
                <div style={{ marginTop: "1rem" }}>
                    <h3>Actieve Sessie ID: {loaderData.sessionData.id}</h3>
                    <p>Aantal items in wachtrij: {loaderData.sessionData.wachtrij.length}</p>
                </div>
            )}

            {lib && (
                <div style={{ marginTop: "1rem" }}>
                    <h3>LearnLib geladen</h3>
                    <Code>{JSON.stringify(lib)}</Code>
                </div>
            )}
            {!inputFound && (
                <h2>
                    Input niet gevonden!! ref is kapot!
                </h2>
            )}

        </>
    );
}
