import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import { Button, Card, Progress, Select } from "@siemsiem/beerreact";
import { omzetLijstNaarKaartStaten } from "~/utils/learn/omzet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/utils/trpc/react";
import { learnFormat } from "../../../generated/prisma/enums";

export default function SessionStartPage() {
    const [searchParams] = useSearchParams();
    const params = useParams();
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const initialFormatParam = searchParams.get("format") || searchParams.get("methode") || searchParams.get("type");
    const initialFormat = (initialFormatParam && Object.values(learnFormat).includes(initialFormatParam as any))
        ? (initialFormatParam as learnFormat)
        : learnFormat.toets;
    const [format, setformat] = useState<learnFormat>(initialFormat);

    const listId = params.listId || searchParams.get("listId") || searchParams.get("id") || "";

    const trpc = useTRPC();
    const make = useMutation(
        trpc.learn.upsertLearnSession.mutationOptions({
            onSuccess: (createdSession) => {
                navigate(`/app/learn/${createdSession.id}?type=session`);
            },
            onError: (myError) => {
                setError(myError.message);
            },
        })
    );

    const loadListData = useQuery(
        trpc.learn.getList.queryOptions(
            { id: listId },
        )
    );

    const handleCreateSession = async () => {
        setError(null);
        try {
            if (loadListData.data?.listItems && loadListData.data.listItems.length > 0) {
                make.mutate({
                    listId: loadListData.data.id,
                    wachtrij: omzetLijstNaarKaartStaten(loadListData.data.listItems),
                    methode: format,
                });
            } else {
                throw new Error("Geen geldige lijst gevonden of de lijst heeft geen vragen.");
            }
        } catch (e: any) {
            setError(e?.message || "Er is een fout opgetreden bij het aanmaken van de sessie.");
        }
    };

    useEffect(() => {
        const auto = searchParams.get("auto") === "true" || searchParams.get("autostart") === "true" || searchParams.get("autoload") === "true" || searchParams.get("autoload") === "1";
        if (auto && loadListData.data?.listItems && loadListData.data.listItems.length > 0 && !make.isPending && !make.isSuccess) {
            handleCreateSession();
        }
    }, [loadListData.data, searchParams]);

    return (
        <div style={{ padding: "1.5rem", maxWidth: "600px", margin: "0 auto" }}>
            {!listId ? (
                <Card>
                    <p style={{ color: "red" }}>Geen lijst ID opgegeven.</p>
                </Card>
            ) : loadListData.isPending ? (
                <Progress />
            ) : (
                <Card>
                    <h3>Sessie Starten</h3>
                    {loadListData.data ? (
                        <>
                            <p><strong>Lijst:</strong> {loadListData.data.name}</p>
                            <p><strong>Aantal vragen:</strong> {loadListData.data.listItems.length}</p>

                            <Select label="Leermethode" value={format} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setformat(e.target.value as learnFormat); }}>
                                <option value={learnFormat.toets}>Toets</option>
                                <option value={learnFormat.leren}>Leren</option>
                                <option value={learnFormat.gedachten}>Gedachten</option>
                            </Select>

                            <Button onClick={handleCreateSession} disabled={make.isPending || loadListData.data.listItems.length === 0} icon="add">
                                {make.isPending ? "Sessie aanmaken..." : "Start!"}
                            </Button>

                        </>
                    ) : (
                        <>
                            <p style={{ color: "red" }}>Lijst niet gevonden.</p>
                        </>
                    )}

                    {make.isPending && (
                        <div style={{ marginTop: "1rem" }}>
                            <Progress />
                        </div>
                    )}

                    {error && (
                        <div style={{ color: "red", marginTop: "1rem" }}>
                            <p><strong>Fout:</strong> {error}</p>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
