import { Button, Card, Progress, Select, Space } from "@siemsiem/beerreact";
import { globalModuleTracker } from "@siemsiem/learnlib";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { LearnSettings } from "~/components/LearnSettings";
import { omzetLijstNaarKaartStaten } from "~/utils/learn/omzet";
import { useTRPC } from "~/utils/trpc/react";
import { learnFormat } from "../../../generated/prisma/enums";

export default function SessionStartPage() {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const initialFormatParam =
    searchParams.get("format") ||
    searchParams.get("methode") ||
    searchParams.get("type");
  const initialFormat =
    initialFormatParam &&
      Object.values(learnFormat).includes(initialFormatParam as learnFormat)
      ? (initialFormatParam as learnFormat)
      : learnFormat.toets;
  const [format, setformat] = useState<learnFormat>(initialFormat);
  const [configJson, setConfigJson] = useState<string>(() =>
    globalModuleTracker.exportConfigJson(),
  );

  const listId =
    params.listId || searchParams.get("listId") || searchParams.get("id") || "";

  const trpc = useTRPC();
  const make = useMutation(
    trpc.learn.upsertLearnSession.mutationOptions({
      onSuccess: (createdSession) => {
        navigate(`/app/learn/${createdSession.id}?type=session`);
      },
      onError: (myError) => {
        setError(myError.message);
      },
    }),
  );

  const loadListData = useQuery(
    trpc.learn.getList.queryOptions(
      { id: listId },
      { enabled: Boolean(listId) },
    ),
  );

  const handleCreateSession = useCallback(() => {
    setError(null);
    try {
      if (
        loadListData.data?.listItems &&
        loadListData.data.listItems.length > 0
      ) {
        const kaartStaten = omzetLijstNaarKaartStaten(
          loadListData.data.listItems,
        );
        make.mutate({
          listId: loadListData.data.id,
          wachtrij: kaartStaten,
          lijst: kaartStaten,
          methode: format,
          config: JSON.parse(configJson),
        });
      } else {
        throw new Error(
          "Geen geldige lijst gevonden of de lijst heeft geen vragen.",
        );
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Er is een fout opgetreden bij het aanmaken van de sessie.",
      );
    }
  }, [loadListData.data, format, configJson, make]);

  useEffect(() => {
    const auto =
      searchParams.get("auto") === "true" ||
      searchParams.get("autostart") === "true" ||
      searchParams.get("autoload") === "true" ||
      searchParams.get("autoload") === "1";
    if (
      auto &&
      loadListData.data?.listItems &&
      loadListData.data.listItems.length > 0 &&
      !make.isPending &&
      !make.isSuccess
    ) {
      handleCreateSession();
    }
  }, [
    loadListData.data,
    searchParams,
    make.isPending,
    make.isSuccess,
    handleCreateSession,
  ]);

  return (
    <main className="responsive">
      <div className="large-width" style={{ margin: "0 auto" }}>
        <nav>
          <Button
            variant="transparent"
            icon="arrow_back"
            onClick={() =>
              navigate(listId ? `/app/lists/${listId}` : "/app/lists/mylists")
            }
          >
            Terug naar lijst
          </Button>
        </nav>

        <Space size="small-space" />

        {!listId ? (
          <Card>
            <div className="center-align padding">
              <i className="extra error-text">error</i>
              <p className="error-text">Geen lijst ID opgegeven.</p>
            </div>
          </Card>
        ) : loadListData.isPending ? (
          <Card>
            <div className="center-align padding">
              <Progress />
              <Space size="small-space" />
              <p className="secondary-text">Lijst laden...</p>
            </div>
          </Card>
        ) : !loadListData.data ? (
          <Card>
            <div className="center-align padding">
              <i className="extra error-text">search_off</i>
              <p className="error-text">Lijst niet gevonden.</p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <nav className="no-space">
                <div className="max">
                  <h2 style={{ margin: "0.25rem 0 0" }}>
                    {loadListData.data.name}
                  </h2>
                </div>
                <span className="chip small">
                  <i>quiz</i>
                  <span>{loadListData.data.listItems.length} vragen</span>
                </span>
              </nav>

              <Space />

              <Select
                label="Leermethode"
                value={format}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setformat(e.target.value as learnFormat);
                }}
              >
                <option value={learnFormat.toets}>Toets</option>
                <option value={learnFormat.leren}>Leren</option>
                <option value={learnFormat.gedachten}>Gedachten</option>
              </Select>

              <Space />

              <Button
                onClick={handleCreateSession}
                disabled={
                  make.isPending || loadListData.data.listItems.length === 0
                }
                icon="play_arrow"
                size="large"
                responsive
              >
                {make.isPending ? "Sessie aanmaken..." : "Start sessie"}
              </Button>

              {make.isPending && (
                <>
                  <Space size="small-space" />
                  <Progress />
                </>
              )}

              {error && (
                <>
                  <Space size="small-space" />
                  <p className="error-text">
                    <strong>Fout:</strong> {error}
                  </p>
                </>
              )}
            </Card>

            <Space />

            <Card>
              <LearnSettings onChange={setConfigJson} />
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
