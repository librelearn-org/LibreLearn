import {
  Button,
  Card,
  Progress,
  Select,
  Space,
  Switch,
} from "@siemsiem/beerreact";
import { globalModuleTracker } from "@siemsiem/learnlib";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  LearnSettings,
  type SelectedLearnModules,
} from "~/components/LearnSettings";
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
  const [useSavedProgress, setUseSavedProgress] = useState(true);
  const [selectedModules, setSelectedModules] = useState<SelectedLearnModules>(
    () => ({
      methodId: globalModuleTracker.getMethods()[0]?.id ?? "simple",
      graderId: globalModuleTracker.getGradeMakers()[0]?.id ?? "basic",
      queueUpdaterId: globalModuleTracker.getQueueUpdaters()[0]?.id ?? "simple",
    }),
  );
  const [configJson, setConfigJson] = useState<string>(() =>
    globalModuleTracker.exportConfigJson(),
  );

  const listId =
    params.listId || searchParams.get("listId") || searchParams.get("id") || "";

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const make = useMutation(
    trpc.learn.upsertLearnSession.mutationOptions({
      onSuccess: (createdSession) => {
        queryClient.invalidateQueries(
          trpc.learn.getListSettings.queryFilter({ id: listId }),
        );
        queryClient.invalidateQueries(
          trpc.learn.getListProgress.queryFilter({ id: listId }),
        );
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

  const listProgress = useQuery(
    trpc.learn.getListProgress.queryOptions(
      { id: listId },
      { enabled: Boolean(listId), staleTime: 0 },
    ),
  );

  const listSettingsQuery = useQuery(
    trpc.learn.getListSettings.queryOptions(
      { id: listId },
      { enabled: Boolean(listId), staleTime: 0 },
    ),
  );
  const hasRestoredDefaults = useRef(false);

  useEffect(() => {
    if (hasRestoredDefaults.current || !listId || !listSettingsQuery.data) {
      return;
    }
    hasRestoredDefaults.current = true;
    const saved = listSettingsQuery.data;

    if (!initialFormatParam && saved.learnFormat) {
      setformat(saved.learnFormat);
    }
    setSelectedModules({
      methodId: saved.methodId,
      graderId: saved.graderId,
      queueUpdaterId: saved.queueUpdaterId,
    });
  }, [listId, listSettingsQuery.data, initialFormatParam]);

  const handleCreateSession = useCallback(() => {
    setError(null);
    try {
      if (
        loadListData.data?.listItems &&
        loadListData.data.listItems.length > 0
      ) {
        const kaartStaten = omzetLijstNaarKaartStaten(
          loadListData.data.listItems,
          selectedModules.methodId,
        );
        make.mutate({
          listId: loadListData.data.id,
          wachtrij: kaartStaten,
          lijst: kaartStaten,
          methode: format,
          config: {
            ...JSON.parse(configJson),
            __modules: selectedModules,
          },
          useSavedProgress,
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
  }, [
    loadListData.data,
    format,
    configJson,
    selectedModules,
    useSavedProgress,
    make,
  ]);

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

              {listProgress.data && listProgress.data.learnedCount > 0 && (
                <>
                  <Space size="small-space" />
                  <nav className="no-space">
                    <div className="max">
                      <div>Eerdere voortgang meenemen</div>
                      <div className="secondary-text small-text">
                        {listProgress.data.learnedCount} van{" "}
                        {listProgress.data.totalCount} kaarten hebben eerdere
                        leervoortgang
                      </div>
                    </div>
                    <Switch
                      checked={useSavedProgress}
                      onChange={(e) =>
                        setUseSavedProgress(e.currentTarget.checked)
                      }
                      icon=""
                    />
                  </nav>
                </>
              )}

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
              <LearnSettings
                selectedModules={selectedModules}
                onModulesChange={setSelectedModules}
                onChange={setConfigJson}
              />
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
