import { useState } from "react";
import { Link } from "react-router";
import { Button, Card, Input, Progress } from "@siemsiem/beerreact";
import { trpcClient } from "~/utils/trpc/client";
import { omzetLijstNaarKaartStaten } from "~/utils/learn/omzet";

export default function TestingPage() {
    const [inputVal, setInputVal] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdSession, setCreatedSession] = useState<any | null>(null);

    const handleCreateSession = async () => {
        setLoading(true);
        setError(null);
        setCreatedSession(null);

        try {
            let wachtrij: Array<{ vraag: string; antwoord: string }> = [];
            let validListId: string | undefined = undefined;

            if (inputVal.trim()) {
                try {
                    const list = await trpcClient.learn.getList.query({ id: inputVal.trim() });
                    if (list && list.listItems.length > 0) {
                        validListId = list.id;
                        wachtrij = omzetLijstNaarKaartStaten(list.listItems)
                    }
                } catch {
                    // Als het geen geldige listId is, gebruiken we de ingevoerde tekst als testvraag
                }
            }

            // Fallback als er geen lijst gevonden is
            if (wachtrij.length === 0) {
                wachtrij = [
                    {
                        vraag: inputVal.trim() || "Voorbeeldvraag",
                        antwoord: "Voorbeeldantwoord",
                    },
                ];
            }

            const session = await trpcClient.learn.upsertLearnSession.mutate({
                listId: validListId,
                wachtrij,
            });

            setCreatedSession(session);
        } catch (e: any) {
            setError(e?.message || "Er is een fout ingetreden bij het aanmaken van de sessie.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "1.5rem", maxWidth: "600px", margin: "0 auto" }}>
            <Card>
                <h3>Sessie Aanmaken Testpagina</h3>
                <p>Voer een Lijst ID in (of een testvraag) om een nieuwe leersessie aan te maken:</p>

                <div style={{ marginBottom: "1rem" }}>
                    <Input
                        label="Lijst ID of Vraag"
                        value={inputVal}
                        onChange={(e) => setInputVal((e.target as HTMLInputElement).value)}
                    />
                </div>

                <Button onClick={handleCreateSession} disabled={loading} icon="add">
                    {loading ? "Sessie aanmaken..." : "Maak Leersessie Aan"}
                </Button>

                {loading && (
                    <div style={{ marginTop: "1rem" }}>
                        <Progress />
                    </div>
                )}

                {error && (
                    <div style={{ color: "red", marginTop: "1rem" }}>
                        <p><strong>Fout:</strong> {error}</p>
                    </div>
                )}

                {createdSession && (
                    <div style={{ marginTop: "1.5rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
                        <h4>✅ Leersessie Aangemaakt!</h4>
                        <p><strong>Sessie ID:</strong> <code>{createdSession.id}</code></p>
                        {createdSession.listId && <p><strong>Lijst ID:</strong> <code>{createdSession.listId}</code></p>}
                        <p><strong>Aantal vragen in wachtrij:</strong> {createdSession.wachtrij?.length || 0}</p>

                        <div style={{ marginTop: "1rem" }}>
                            <Link to={`/app/learn/${createdSession.id}?type=session`} style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                                🚀 Ga naar de leerpagina met deze sessie metadata
                            </Link>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
