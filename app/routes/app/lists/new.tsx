import { useTRPC } from "~/utils/trpc/react";
import type { Route } from "./+types/new";
import { useMutation } from "@tanstack/react-query";
import { Button, Input as BeerInputRaw, type InputProps } from "@siemsiem/beerreact";
import React from "react";
const Input = BeerInputRaw as React.ComponentType<InputProps & React.InputHTMLAttributes<HTMLInputElement>>;
import { trpcClient } from "~/utils/trpc/client";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
// import "~/components/text-field/text-field.css"
import { getSubjectBySlug, subjects } from "~/components/Icons";
import { useTranslation } from "react-i18next";

type ListItemData = {
    id: string;
    vraag: string;
    antwoord: string;
    listId: string | null;
};

type EditableListData = {
    id: string | undefined;
    name: string;
    language: string;
    toLanguage: string;
    fromLanguage: string;
    ownerId: string;
    listItems: ListItemData[];
};

export async function clientLoader(loaderArgs: Route.LoaderArgs) {
    let listId = loaderArgs.params.listId || undefined;
    let listData = null;
    if (listId === "new") {
        listId = undefined;
    }

    if (listId) {
        const result = await trpcClient.learn.getList.query({ id: listId });
        if (!result) {
            throw new Response("Not Found", { status: 404 });
        }
        listData = {
            ...result,
            fromLanguage: result.language ?? "nl",
            toLanguage: "en",
        };
    } else {
        listData = {
            id: listId,
            name: "",
            language: "nl",
            toLanguage: "en",
            fromLanguage: "nl",
            ownerId: "this-value-is-not-used",
            listItems: []
        }
    }
    if (listData === null) {
        throw new Error("listData should be defined at this point");
    }
    return {
        listId: listId,
        listData: listData
    }
}
function isValidDraft(data: EditableListData) {
    if (!data.name.trim()) return false;
    return data.listItems.every(
        (i) => i.vraag.trim().length > 0 && i.antwoord.trim().length > 0
    );
}

function toPayload(data: EditableListData) {
    return {
        id: data.id,
        name: data.name,
        language: data.language as any,
        fromLanguage: data.fromLanguage as any,
        toLanguage: data.toLanguage as any,
        list: data.listItems.map(({ vraag, antwoord }) => ({ vraag, antwoord })),
    };
}
export default function newList({ loaderData }: Route.ComponentProps) {
    const trpc = useTRPC();
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const lastSavedHashRef = useRef("");

    const [listData, setListData] = useState<EditableListData>(loaderData.listData);
    const nav = useNavigate();
    const { t } = useTranslation();

    const submitMutation = useMutation({
        ...trpc.learn.upsertList.mutationOptions(),
        onSuccess: (data) => {
            // nu gaan we naar de viewer van de lijst die we net gemaakt hebben
            nav(`/app/lists/${data.id}`);
        }
    });
    const autoSaveMutation = useMutation({
        ...trpc.learn.upsertList.mutationOptions(),
        onSuccess: (data, variables) => {
            // first autosave for a new list returns a DB id; keep it for future updates
            setListData((current) => (current.id ? current : { ...current, id: data.id }));
            lastSavedHashRef.current = JSON.stringify(variables);
            setSaveState("saved");
        },
        onError: () => setSaveState("error"),

    });

    const handleSave = () => {
        submitMutation.mutate({
            id: listData.id,
            name: listData.name,
            language: listData.language as any,
            fromLanguage: ("fromLanguage" in listData ? listData.fromLanguage : "nl") as any,
            toLanguage: ("toLanguage" in listData ? listData.toLanguage : "en") as any,
            list: listData.listItems.map(({ vraag, antwoord }) => ({
                vraag,
                antwoord,
            })),
        });
    };
    useEffect(() => {
        if (!isValidDraft(listData)) return;

        const payload = toPayload(listData);
        const hash = JSON.stringify(payload);
        if (hash === lastSavedHashRef.current) return;

        const timer = setTimeout(() => {
            if (autoSaveMutation.isPending) return;
            setSaveState("saving");
            autoSaveMutation.mutate(payload);
        }, 800); // debounce

        return () => clearTimeout(timer);
    }, [listData]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 m-2 p-5 bg-openlearn-800 rounded-lg">
                <label>
                    <Input
                        type="text"
                        value={listData.name}
                        placeholder="Name of the list"
                        className="text-field1"
                        onChange={(e) =>
                            setListData((current) => ({
                                ...current,
                                name: e.target.value,
                            }))
                        }
                    />
                    <p>
                        {saveState === "saving" && "Saving..."}
                        {saveState === "saved" && "All changes saved"}
                        {saveState === "error" && "Error saving changes"}
                    </p>
                </label>
                <div className="flex flex-row gap-2">
                    <label>
                        Subject:
                        <select
                            value={listData.language || "nl"}
                            onChange={(e) => {
                                // we halen die shit op van een slug
                                const taalData = getSubjectBySlug(e.target.value)
                                // nu weten we ook hoe de andere 2 oelewapeprs moetne
                                if (taalData) {
                                    setListData((current) => ({
                                        ...current,
                                        language: e.target.value,
                                        toLanguage: taalData.taalData.naar,
                                        fromLanguage: taalData.taalData.van
                                    }))
                                } else {
                                    setListData((current) => ({
                                        ...current,
                                        language: e.target.value
                                    }))
                                }
                            }
                            }
                            className="text-field1"
                        >
                            {subjects.map((s) => (
                                <option key={s.slug} value={s.slug}>
                                    {t(s.name)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        From:
                        <select
                            value={listData.fromLanguage || "nl"}
                            onChange={(e) =>
                                setListData((current) => ({
                                    ...current,
                                    fromLanguage: e.target.value,
                                }))
                            }
                            className="text-field1"
                        >
                            {subjects.map((s) => (
                                <option key={s.slug} value={s.slug}>
                                    {t(s.name)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        To:
                        <select
                            value={listData.toLanguage || "en"}
                            onChange={(e) =>
                                setListData((current) => ({
                                    ...current,
                                    toLanguage: e.target.value,
                                }))
                            }
                            className="text-field1"
                        >
                            {subjects.map((s) => (
                                <option key={s.slug} value={s.slug}>
                                    {t(s.name)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>
            <div className="flex flex-col">
                {listData.listItems.map((item, index) => (
                    <div key={index} className="row no-space">
                        <Input
                            value={item.vraag}
                            placeholder="Vraag"
                            className="text-field1"
                            onChange={(e) => {
                                const newVraag = (e.target as HTMLInputElement).value;
                                setListData((current) => {
                                    const newListItems = [...current.listItems];
                                    newListItems[index] = {
                                        ...newListItems[index],
                                        vraag: newVraag,
                                    };
                                    return {
                                        ...current,
                                        listItems: newListItems,
                                    };
                                });
                            }}
                        />
                        <Input
                            type="text"
                            value={item.antwoord}
                            placeholder="Antwoord"
                            className="text-field1"
                            onChange={(e) => {
                                const newAntwoord = (e.target as HTMLInputElement).value;
                                setListData((current) => {
                                    const newListItems = [...current.listItems];
                                    newListItems[index] = {
                                        ...newListItems[index],
                                        antwoord: newAntwoord,
                                    };
                                    return {
                                        ...current,
                                        listItems: newListItems,
                                    };
                                });
                            }}
                        />

                        <Button onClick={() => {
                            setListData((current) => {
                                const newListItems = current.listItems.filter((_, i) => i !== index);
                                return {
                                    ...current,
                                    listItems: newListItems,
                                };
                            });
                        }} variant="transparent"
                            shape='circle'
                            icon="delete">
                        </Button>
                    </div>
                ))}
            </div>

            <div className="flex flex-row">
                <Button onClick={() => setListData((current) => ({
                    ...current,
                    listItems: [...current.listItems, { id: crypto.randomUUID(), vraag: "", antwoord: "", listId: current.id ?? null }],
                }))} icon="add" shape='circle'>
                </Button>

                <Button onClick={handleSave}>Save</Button>
            </div>
        </div>
    );
}