import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import { Button, Card, Input, Progress } from "@siemsiem/beerreact";
import { omzetLijstNaarKaartStaten } from "~/utils/learn/omzet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/utils/trpc/react";

export default function SessionStartPage() {
    const [searchParams] = useSearchParams();
    const params = useParams();
    const [manualListId, setManualListId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const listId = searchParams.get("listId") || searchParams.get("id") || params.listId || manualListId;

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
            { enabled: !!listId }
        )
    );

    const handleCreateSession = async () => {
        setError(null);
        try {
            if (loadListData.data?.listItems && loadListData.data.listItems.length > 0) {
                make.mutate({
                    listId: loadListData.data.id,
                    wachtrij: omzetLijstNaarKaartStaten(loadListData.data.listItems),
                });
            } else {
                throw new Error("Geen geldige lijst gevonden of de lijst heeft geen vragen.");
            }
        } catch (e: any) {
            setError(e?.message || "Er is een fout opgetreden bij het aanmaken van de sessie.");
        }
    };

    useEffect(() => {
        const auto = searchParams.get("auto") === "true" || searchParams.get("autostart") === "true";
        if (auto && loadListData.data?.listItems && loadListData.data.listItems.length > 0 && !make.isPending && !make.isSuccess) {
            handleCreateSession();
        }
    }, [loadListData.data, searchParams]);

    return (
        <div style={{ padding: "1.5rem", maxWidth: "600px", margin: "0 auto" }}>
            {!listId ? (
                <Card>
                    <h3>Sessie Starten</h3>
                    <p>Voer een Lijst ID in om een leersessie aan te maken:</p>
                    <div style={{ marginBottom: "1rem" }}>
                        <Input
                            label="Lijst ID"
                            value={manualListId}
                            onChange={(e) => setManualListId(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleCreateSession} disabled={!manualListId || make.isPending} icon="add">
                        {make.isPending ? "Sessie aanmaken..." : "Start!"}
                    </Button>
                    {error && (
                        <div style={{ color: "red", marginTop: "1rem" }}>
                            <p><strong>Fout:</strong> {error}</p>
                        </div>
                    )}
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

                            <Button onClick={handleCreateSession} disabled={make.isPending || loadListData.data.listItems.length === 0} icon="add">
                                {make.isPending ? "Sessie aanmaken..." : "Start!"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <p style={{ color: "red" }}>Lijst niet gevonden.</p>
                            <div style={{ marginBottom: "1rem" }}>
                                <Input
                                    label="Lijst ID"
                                    value={manualListId}
                                    onChange={(e) => setManualListId(e.target.value)}
                                />
                            </div>
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
