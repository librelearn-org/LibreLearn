import {
  Button,
  Card,
  Code,
  classNames,
  Input,
  Space,
  useDialog,
} from "@siemsiem/beerreact";
import Learnlib, {
  checkAnswer,
  Grade,
  gradeMakers,
  type LearnlibState,
  methodes,
  wachtrijUpdaters,
} from "@siemsiem/learnlib";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { trpcClient } from "~/utils/trpc/client";
import { useTRPC } from "~/utils/trpc/react";
import { learnFormat } from "../../../generated/prisma/enums";
import type { Route } from "./+types/learn";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const id = params.id;

  let sessionData: Awaited<
    ReturnType<typeof trpcClient.learn.getLearnSession.query>
  > | null = null;
  let error: string | null = null;

  if (!id) {
    return { id: null, sessionData: null, error: "Geen ID opgegeven" };
  }

  try {
    sessionData = await trpcClient.learn.getLearnSession.query({ id });
  } catch (e: unknown) {
    error =
      e instanceof Error ? e.message : "Fout bij het ophalen van de leersessie";
  }

  return {
    id,
    sessionData,
    error,
  };
}

declare module "@siemsiem/beerreact" {
  interface InputProps {
    ref?: React.Ref<HTMLInputElement>;
  }
}

interface FeedbackState {
  question: string;
  expectedAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
}

export default function LearnPage({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pushDialog } = useDialog();
  const veld = useRef<HTMLInputElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

  const sessionId = loaderData.sessionData?.id;
  const rawWachtrij = loaderData.sessionData?.wachtrij;
  const rawLijst = loaderData.sessionData?.lijst;
  const currentFormat =
    loaderData.sessionData?.learnFormat ?? learnFormat.toets;

  const trpc = useTRPC();
  const saveSession = useMutation(
    trpc.learn.upsertLearnSession.mutationOptions({
      onError: (err) => {
        console.error("Fout bij opslaan voortgang:", err);
      },
    }),
  );

  const lib = useMemo(() => {
    if (resetKey > 0) {
      const fullList = rawLijst && rawLijst.length > 0 ? rawLijst : (rawWachtrij ?? []);
      if (fullList.length > 0) {
        return new Learnlib(
          fullList,
          methodes[0],
          gradeMakers[0],
          wachtrijUpdaters[0],
        );
      }
    }
    if (rawWachtrij || rawLijst) {
      const wachtrij = rawWachtrij ?? [];
      const lijst = rawLijst && rawLijst.length > 0 ? rawLijst : wachtrij;
      if (wachtrij.length > 0 || lijst.length > 0) {
        return new Learnlib(
          {
            wachtrij,
            lijst,
            wachtrijState: {
              current: wachtrij[0] ?? null,
              isKlaar: wachtrij.length === 0,
              initialCount: lijst.length || wachtrij.length,
              progress:
                lijst.length > 0
                  ? (lijst.length - wachtrij.length) / lijst.length
                  : 0,
            },
          },
          methodes[0],
          gradeMakers[0],
          wachtrijUpdaters[0],
        );
      }
    }
    return null;
  }, [rawWachtrij, rawLijst, resetKey]);

  const [state, setState] = useState<LearnlibState | null>(
    () => lib?.getSnapshot() ?? null,
  );

  useEffect(() => {
    if (!lib) return;
    setState(lib.getSnapshot());
    return lib.subscribe(setState);
  }, [lib]);

  useEffect(() => {
    if (resetKey >= 0) {
      setFeedback(null);
      setShowFlashcardAnswer(false);
    }
  }, [resetKey]);

  useEffect(() => {
    if (!feedback && veld.current) {
      veld.current.focus();
    }
  }, [feedback]);

  const syncProgress = useCallback(
    (wachtrij: LearnlibState["wachtrij"], lijst?: LearnlibState["lijst"]) => {
      if (sessionId && wachtrij) {
        saveSession.mutate({
          id: sessionId,
          wachtrij,
          lijst,
          listId: loaderData.sessionData?.listId ?? undefined,
          methode: currentFormat,
        });
      }
    },
    [sessionId, loaderData.sessionData, currentFormat, saveSession],
  );

  useEffect(() => {
    if (resetKey > 0 && lib) {
      syncProgress(lib.wachtrij, lib.lijst);
    }
  }, [resetKey, lib, syncProgress]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lib || !state?.wachtrijState.current || feedback) return;

    const antwoordVal = veld.current?.value ?? "";
    const expected = state.wachtrijState.current.antwoord;
    const isCorrect = checkAnswer(expected, antwoordVal);

    setFeedback({
      question: state.wachtrijState.current.vraag,
      expectedAnswer: expected,
      userAnswer: antwoordVal,
      isCorrect,
    });
  };

  const handleContinue = useCallback(
    (overrideGrade?: Grade) => {
      if (!lib || !feedback) return;

      if (overrideGrade !== undefined) {
        lib.antwoord(feedback.userAnswer, overrideGrade);
      } else {
        lib.antwoord(feedback.userAnswer);
      }

      if (veld.current) {
        veld.current.value = "";
      }
      setFeedback(null);
      syncProgress(lib.wachtrij, lib.lijst);
    },
    [lib, feedback, syncProgress],
  );

  const handleOverride = useCallback(() => {
    handleContinue(Grade.GoedPrima);
  }, [handleContinue]);

  const handleFlashcardGrade = (grade: Grade) => {
    if (!lib || !state?.wachtrijState.current) return;
    lib.antwoord(state.wachtrijState.current.antwoord, grade);
    setShowFlashcardAnswer(false);
    syncProgress(lib.wachtrij, lib.lijst);
  };

  useEffect(() => {
    if (!feedback) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (document.activeElement?.getAttribute("data-override") === "true") {
          return;
        }
        e.preventDefault();
        handleContinue();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [feedback, handleContinue]);

  const dbg = () => {
    pushDialog({
      content: debugPopup({ loaderData }, lib, veld.current !== null),
      pos: "left",
    });
  };

  const isTestOrLearnMode =
    currentFormat === learnFormat.toets || currentFormat === learnFormat.leren;
  const isFlashcardMode = currentFormat === learnFormat.gedachten;

  return (
    <>
      <div className="center middle absolute">
        <div className="medium-width">
          {lib && state && !state.wachtrijState.isKlaar && !loaderData.error && (
            <>
              <nav className="no-space">
                <span className="max secondary-text small-text">
                  {t("learn:queue")}: {state.wachtrij.length} /{" "}
                  {state.wachtrijState.initialCount}
                </span>
                <span className="secondary-text small-text">
                  {Math.round(
                    ((state.wachtrijState.initialCount - state.wachtrij.length) /
                      (state.wachtrijState.initialCount || 1)) *
                      100,
                  )}
                  %
                </span>
              </nav>
              <progress
                value={state.wachtrijState.initialCount - state.wachtrij.length}
                max={state.wachtrijState.initialCount}
              ></progress>
              <div className="space"></div>
            </>
          )}

          <Card>
            {loaderData.error ? (
              <div className="center-align padding">
                <p className="error-text">{loaderData.error}</p>
              </div>
            ) : !lib || !state ? (
              <div className="center-align padding">
                <p>{t("learn:noItems")}</p>
              </div>
            ) : state.wachtrijState.isKlaar ? (
              <div className="center-align padding">
                <i className="extra green-text">check_circle</i>
                <h2>{t("learn:congratsTitle")}</h2>
                <p>{t("learn:congratsDescription")}</p>
                <Space />
                <nav className="responsive center-align">
                  <Button
                    onClick={() => setResetKey((k) => k + 1)}
                    icon="refresh"
                  >
                    {t("learn:learnAgain")}
                  </Button>
                  {loaderData.sessionData?.listId && (
                    <Button
                      variant="transparent"
                      onClick={() =>
                        navigate(
                          `/app/lists/${loaderData.sessionData?.listId}`,
                        )
                      }
                      icon="arrow_back"
                    >
                      {t("learn:backToList")}
                    </Button>
                  )}
                </nav>
              </div>
            ) : isFlashcardMode ? (
              <nav className="vertical center-align no-space">
                <p className="secondary-text small-text">
                  {t("learn:question")}
                </p>
                <h3 className={classNames.text.bold}>{state.wachtrijState.current?.vraag}</h3>

                <div className="space"></div>
                {showFlashcardAnswer ? (
                  <div className="max">
                    <p className="secondary-text small-text">
                      {t("learn:correctAnswer")}
                    </p>
                    <h4 className="green-text bold">
                      {state.wachtrijState.current?.antwoord}
                    </h4>
                    <Space />
                    <nav className="responsive center-align">
                      <Button
                        onClick={() => handleFlashcardGrade(Grade.Fout)}
                        icon="close"
                        className="error"
                      >
                        {t("learn:dontKnow")}
                      </Button>
                      <Button
                        onClick={() => handleFlashcardGrade(Grade.GoedPrima)}
                        icon="check"
                        className="primary"
                      >
                        {t("learn:know")}
                      </Button>
                    </nav>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowFlashcardAnswer(true)}
                    icon="visibility"
                    size="large"
                    responsive
                  >
                    {t("learn:showAnswer")}
                  </Button>
                )}
              </nav>
            ) : isTestOrLearnMode ? (
              feedback ? (
                <nav className="vertical center-align no-space">
                  {feedback.isCorrect ? (
                    <div className="center-align">
                      <i className="extra green-text">check_circle</i>
                      <h3 className="green-text">{t("learn:correct")}</h3>
                      <article className="border left-align round surface-container fill">
                        <p className="secondary-text medium-text">
                          {t("learn:question")}
                        </p>
                        <h5 className={classNames.text.bold}>
                          {feedback.question}
                        </h5>
                        <div className="small-space"></div>
                        <p className="secondary-text medium-text">
                          {t("learn:yourAnswer")}
                        </p>
                        <h5 className="green-text bold">
                          {feedback.userAnswer}
                        </h5>
                      </article>
                      <Space />
                      <Button
                        autoFocus
                        onClick={() => handleContinue()}
                        icon="arrow_forward"
                        size="large"
                        responsive
                      >
                        {t("learn:continue")}
                      </Button>
                    </div>
                  ) : (
                    <div className="center-align">
                      <i className="extra error-text">cancel</i>
                      <h3 className="error-text">{t("learn:incorrect")}</h3>
                      <article className="border left-align round surface-container fill">
                        <p className="secondary-text medium-text">
                          {t("learn:question")}
                        </p>
                        <h5 className={classNames.text.bold}>
                          {feedback.question}
                        </h5>
                        <div className="small-space"></div>
                        <p className="secondary-text medium-text">
                          {t("learn:yourAnswer")}
                        </p>
                        <h5 className="error-text bold">
                          {feedback.userAnswer || <i>{t("learn:noAnswer")}</i>}
                        </h5>
                        <div className="small-space"></div>
                        <p className="secondary-text medium-text">
                          {t("learn:correctAnswer")}
                        </p>
                        <h5 className="green-text bold">
                          {feedback.expectedAnswer}
                        </h5>
                      </article>
                      <Space />
                      <nav className="responsive center-align">
                        <Button
                          autoFocus
                          onClick={() => handleContinue()}
                          icon="arrow_forward"
                        >
                          {t("learn:continue")}
                        </Button>
                        <Button
                          data-override="true"
                          variant="transparent"
                          onClick={handleOverride}
                          icon="check"
                        >
                          {t("learn:overrideCorrect")}
                        </Button>
                      </nav>
                    </div>
                  )}
                </nav>
              ) : (
                <form onSubmit={handleSubmit}>
                  <nav className="vertical center-align no-space">
                    <p className="secondary-text small-text">
                      {t("learn:question")}
                    </p>
                    <h3 className={classNames.text.bold}>
                      {state.wachtrijState.current?.vraag}
                    </h3>

                    <div className="space"></div>
                    <Input
                      ref={veld}
                      placeholder={t("learn:placeholder")}
                      autoFocus
                    />
                    <Space />
                    <Button type="submit" icon="send" size="large" responsive>
                      {t("learn:answerBtn")}
                    </Button>
                  </nav>
                </form>
              )
            ) : (
              <div className="center-align padding">
                <p className="error-text">{t("learn:onlyTestSupported")}</p>
              </div>
            )}
          </Card>
        </div>
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

      <p>
        <strong>ID:</strong> <code>{loaderData.id}</code>
      </p>

      {loaderData.error && (
        <div className="error-text space">
          <p>
            <strong>Fout:</strong> {loaderData.error}
          </p>
        </div>
      )}

      {loaderData.sessionData && (
        <div className="space">
          <h3>Actieve Sessie ID: {loaderData.sessionData.id}</h3>
          <p>
            Aantal items in wachtrij: {loaderData.sessionData.wachtrij.length}
          </p>
        </div>
      )}

      {lib && (
        <div className="space">
          <h3>LearnLib geladen</h3>
          <Code>{JSON.stringify(lib)}</Code>
        </div>
      )}
      {!inputFound && <h2>Input niet gevonden!! ref is kapot!</h2>}
    </>
  );
}
