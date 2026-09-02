import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Button, Card, classNames, Progress, useDialog } from "@siemsiem/beerreact";
import { useTRPC } from "~/utils/trpc/react";

export default function AdminHome() {
    const currentUser = useOutletContext<any>();
    const trpc = useTRPC();
    const { pushDialog, closeDialog } = useDialog();
    const [actionError, setActionError] = useState<string | null>(null);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch
    } = useInfiniteQuery(
        trpc.admin.getAllUsers.infiniteQueryOptions(
            { limit: 20 },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
            }
        )
    );

    const toggleBanMutation = useMutation(
        trpc.admin.toggleBanUser.mutationOptions({
            onSuccess: () => {
                setActionError(null);
                refetch();
            },
            onError: (err: any) => {
                setActionError(err.message || "Er is een fout opgetreden bij het aanpassen van de status.");
            }
        })
    );

    const observerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!observerRef.current || !hasNextPage || isFetchingNextPage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(observerRef.current);
        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    const handleToggleBan = useCallback((targetUser: any) => {
        const isBanning = !targetUser.banned;
        pushDialog({
            content: (
                <div>
                    <h5>{isBanning ? "Gebruiker bannen" : "Gebruiker unbannen"}</h5>
                    <p>
                        Weet je zeker dat je <strong>{targetUser.name || targetUser.email}</strong> wilt{" "}
                        {isBanning ? "bannen" : "deblokkeren"}?
                    </p>
                    <div className="row end-align gap-s margin-top">
                        <Button
                            variant="transparent"
                            onClick={() => {
                                toggleBanMutation.mutate({
                                    userId: targetUser.id,
                                    banned: isBanning,
                                });
                                closeDialog();
                            }}
                            icon="check"
                        >
                            {isBanning ? "Ja, ban gebruiker" : "Ja, unban"}
                        </Button>
                    </div>
                </div>
            )
        });
    }, [pushDialog, closeDialog]);

    const allUsers = data?.pages.flatMap((page) => page.users) ?? [];

    return (
        <div className="padding">
            {/* <div className="row left-align">
                <div className="max">
                    <h2>Gebruikersbeheer</h2>
                    <p className="opacity-70">
                        Overzicht van alle geregistreerde gebruikers. Ingelogd als: <strong>{currentUser?.name || currentUser?.email}</strong>
                    </p>
                </div>
            </div> */}

            {actionError && (
                <Card>
                    <p>{actionError}</p>
                </Card>
            )}

            <Card>

                <h4>Gebruikers ({allUsers.length})</h4>

                {isLoading ? (
                    <div className="center-align padding">
                        <Progress></Progress>
                        <p>Gebruikers laden...</p>
                    </div>
                ) : (
                    <table className="stripes">
                        <thead>
                            <tr>
                                <th>Naam</th>
                                <th>E-mail</th>
                                <th>Rol</th>
                                <th>Status</th>
                                <th>Acties</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allUsers.map((u: any) => {
                                const isSelf = u.id === currentUser?.id;
                                return (
                                    <tr key={u.id}>
                                        <td>
                                            {u.name || "Geen naam!?!?!??!"}
                                        </td>
                                        <td>{u.email}</td>
                                        <td>
                                            {u.role || "user"}
                                        </td>
                                        <td>
                                            {u.banned ? "verbanned" : "Actief"}
                                        </td>
                                        <td>
                                            {!isSelf ? (
                                                <Button
                                                    variant="transparent"
                                                    size="small"
                                                    icon={u.banned ? "lock_open" : "block"}
                                                    onClick={() => handleToggleBan(u)}
                                                >
                                                    {u.banned ? "Unban" : "Ban"}
                                                </Button>
                                            ) : (
                                                <span>(Zelfmoord is niet toegestaan)</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {/* Infinite scroll loader / sentinel */}
                <div ref={observerRef} className="padding center-align">
                    {isFetchingNextPage && (
                        <div className="row center-align gap-s">
                            <Progress></Progress>
                            <span>Meer gebruikers laden...</span>
                        </div>
                    )}
                    {hasNextPage && !isFetchingNextPage && (
                        <Button variant="transparent" onClick={() => fetchNextPage()}>
                            Laad meer gebruikers
                        </Button>
                    )}
                    {!hasNextPage && !isLoading && allUsers.length > 0 && (
                        <p className={classNames.text.size.small}>Alle gebruikers zijn geladen.</p>
                    )}
                </div>
            </Card >
        </div>
    );
}

