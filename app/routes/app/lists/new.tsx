import { useTRPC } from "~/utils/trpc/react";
import type { Route } from "./+types/new";
import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, type InputProps, Select, Flex, Card } from "@siemsiem/beerreact";
import React, { useMemo } from "react";
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
            fromLanguage: result.fromLanguage ?? result.language ?? "nl",
            toLanguage: result.toLanguage ?? "en",
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
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "invalid" | "invalid-e">("idle");
    const lastSavedHashRef = useRef("");

    const [listData, setListData] = useState<EditableListData>(loaderData.listData);
    const nav = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    // we hebben 2 mutaties, een voor autosave en een voor de opslaan knop
    const submitMutation = useMutation({
        ...trpc.learn.upsertList.mutationOptions(),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: trpc.learn.getList.queryKey({ id: data.id }) })
            // nu gaan we naar de viewer van de lijst die we net gemaakt hebben
            nav(`/app/lists/${data.id}`);
        },
        onError: () => setSaveState("error"),

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
        if (!isValidDraft(listData)) {
            setSaveState("invalid-e")
            return;
        }
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
    useMemo(() => {
        if (!isValidDraft(listData)) {
            setSaveState("invalid")
            return;
        };

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
        <>
            <Card>
                <Flex directions="vertical">

                    <Flex>
                        <div className="max">

                            <Input
                                type="text"
                                label="Naam"
                                value={listData.name}
                                onChange={(e) =>
                                    setListData((current) => ({
                                        ...current,
                                        name: e.target.value,
                                    }))
                                }
                                output={
                                    saveState === "saving"
                                        ? t("lists:edit:saving")
                                        : saveState === "saved"
                                            ? t("lists:edit:saved")
                                            : saveState === "error"
                                                ? t("lists:edit:error")
                                                : (saveState == "invalid" || saveState == "invalid-e")
                                                    ? t("lists:edit:invalid")
                                                    : undefined
                                }
                                invalid={(saveState === "error" || saveState == "invalid-e")}
                            />
                        </div>
                    </Flex>

                    <Flex className="scroll s">
                        <Select
                            label="Vak:"
                            value={listData.language || "nl"}
                            onChange={(e) => {
                                // we halen die shit op van een slug
                                const taalData = getSubjectBySlug(e.target.value)
                                // nu weten we ook hoe de andere 2 oelewapeprs moetne
                                if (taalData && taalData.slug !== listData.language) {
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
                        </Select>
                        <Select
                            value={listData.fromLanguage || "nl"}
                            onChange={(e) =>
                                setListData((current) => ({
                                    ...current,
                                    fromLanguage: e.target.value,
                                }))
                            }
                            label="Van: "
                        >
                            {subjects.map((s) => (
                                <option key={s.slug} value={s.slug}>
                                    {t(s.name)}
                                </option>
                            ))}
                        </Select>
                        <Select
                            value={listData.toLanguage || "en"}
                            onChange={(e) =>
                                setListData((current) => ({
                                    ...current,
                                    toLanguage: e.target.value,
                                }))
                            }
                            label="Naar: "
                        >
                            {subjects.map((s) => (
                                <option key={s.slug} value={s.slug}>
                                    {t(s.name)}
                                </option>
                            ))}
                        </Select>
                    </Flex>
                    <Flex className="m l">
                        <Select
                            label={t("icons:subject")}
                            value={listData.language || "nl"}
                            onChange={(e) => {
                                // we halen die shit op van een slug
                                const taalData = getSubjectBySlug(e.target.value)
                                // nu weten we ook hoe de andere 2 oelewapeprs moetne
                                if (taalData && taalData.slug !== listData.language) {
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
                        </Select>
                        <Select
                            value={listData.fromLanguage || "nl"}
                            onChange={(e) =>
                                setListData((current) => ({
                                    ...current,
                                    fromLanguage: e.target.value,
                                }))
                            }
                            label={t("icons:from")}
                        >
                            {subjects.map((s) => (
                                <option key={s.slug} value={s.slug}>
                                    {t(s.name)}
                                </option>
                            ))}
                        </Select>
                        <Select
                            value={listData.toLanguage || "en"}
                            onChange={(e) =>
                                setListData((current) => ({
                                    ...current,
                                    toLanguage: e.target.value,
                                }))
                            }
                            label={t("icons:to")}

                        >
                            {subjects.map((s) => (
                                <option key={s.slug} value={s.slug}>
                                    {t(s.name)}
                                </option>
                            ))}
                        </Select>
                    </Flex>
                </Flex>

            </Card>
            <Card>


                {listData.listItems.map((item, index) => (
                    <>
                        <nav key={index} className="row tiny-space m l">
                            <div className="max">

                                <Input
                                    value={item.vraag}
                                    placeholder="Vraag"
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
                            </div>
                            <div className="max">

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
                            </div>


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
                        </nav>
                        <nav key={index} className="row vertical tiny-space s">
                            <div className="max responsive">

                                <Input
                                    value={item.vraag}
                                    placeholder={t("lists:questionU")}
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
                            </div>
                            <div className="max responsive">

                                <Input
                                    type="text"
                                    value={item.antwoord}
                                    placeholder={t("lists:anwserU")}
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
                            </div>


                            <Button
                                about=""
                                onClick={() => {
                                    setListData((current) => {
                                        const newListItems = current.listItems.filter((_, i) => i !== index);
                                        return {
                                            ...current,
                                            listItems: newListItems,
                                        };
                                    });
                                }} variant="transparent"
                                // shape='circle'
                                responsive

                                icon="delete">
                                {t("lists:edit:deleteWordBtn")}
                            </Button>
                        </nav>
                    </>
                ))}
                <div className="center-align padding">
                    <nav className="center-align">
                        <Button onClick={() => setListData((current) => ({
                            ...current,
                            listItems: [...current.listItems, { id: crypto.randomUUID(), vraag: "", antwoord: "", listId: current.id ?? null }],
                        }))} icon="add">
                            {t("lists:edit:addToList")}
                        </Button>
                        <Button onClick={handleSave} icon="save" className="s">
                            {t("lists:edit:save")}
                        </Button>
                    </nav>


                </div>
            </Card>
            <div className="fixed right bottom padding m l">
                <Button onClick={handleSave} icon="save" FAB shape="square" extendedFAB> {t("lists:edit:save")}</Button>

            </div>
        </ >
    );
}