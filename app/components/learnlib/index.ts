import assert from "node:assert";
import type { LearnConfig, Lijst, LijstItem } from "./types";
import { shuffle } from "./helpers"

export interface LearnLibState {
  lijst: Record<string, LijstItem>;
  wachtrij: string[];
  config: LearnConfig;
}

export default class learnLibReact {
  private lijst: Record<string, LijstItem> = {};
  private wachtrij: string[] = [];
  private config: LearnConfig = {};
  private stateUpdater: ((state: LearnLibState) => void) | null = null;

  constructor(lijst: Lijst, config: LearnConfig) {
    lijst.forEach((value: LijstItem) => {
      if (!value.id) {
        value.id = crypto.randomUUID();
      };
      this.lijst[value.id] = value;
      this.wachtrij.push(value.id);
    });
    this.config = config;
    shuffle(this.wachtrij);
  };

  // Bind state setter from useState hook
  public setStateUpdater(updater: (state: LearnLibState) => void) {
    this.stateUpdater = updater;
    this.notifyStateChange();
  };

  // Internal method to notify state changes
  private notifyStateChange() {
    if (this.stateUpdater) {
      this.stateUpdater({
        lijst: this.lijst,
        wachtrij: this.wachtrij,
        config: this.config,
      });
    }
  };

  // Get current state
  public getState(): LearnLibState {
    return {
      lijst: this.lijst,
      wachtrij: this.wachtrij,
      config: this.config,
    };
  };

  // herstel de lijst en wachtrij naar de start
  public reshuffle() {
    // we resten de wachtrij
    this.wachtrij = [];
    // nu verwijderen we de goed/fout data en bouwen we een nieuwe wachtrij.
    for (let lijstItemIndex in Object.keys(this.lijst)) {
      let lijstItem = Object.values(this.lijst)[lijstItemIndex];
      lijstItem.listSessionItemAnswerHistories = [];
      assert(lijstItem.id, 'Er is een object zonder een id in de reshuffel functie gekomen. knap!')
      this.wachtrij.push(lijstItem.id)
    };
    this.notifyStateChange();
  };
  private checkAwnser(antwoord: string): boolean {
    const currentItemId = this.wachtrij[0];
    const currentItem = this.lijst[currentItemId];
    if (!currentItem) {
      throw new Error("Er is geen current item in de antwoord functie. knap!");
    }
    // TODO: hier de config gebruiken om strengheid van het nakijken te bepalen
    return antwoord === currentItem.antwoord;
  }

  public antwoord(antwoord: string, overRuleCorrect?: boolean) {
    const currentItemId = this.wachtrij[0];
    const currentItem = this.lijst[currentItemId];
    if (!currentItem) {
      throw new Error("Er is geen current item in de antwoord functie. knap!");
    }
    const isCorrect = antwoord === currentItem.antwoord;
    currentItem.listSessionItemAnswerHistories?.push({
      antwoord,
      goed: this.checkAwnser(antwoord) || overRuleCorrect || false,
      round: currentItem.roundCount || 0,
    });
    // we verwijderen het item uit de wachtrij
    this.wachtrij.shift();
    // als het fout was, dan pushen we het item terug in de wachtrij
    if (!isCorrect) {
      this.wachtrij.push(currentItemId);
    }
    currentItem.roundCount = (currentItem.roundCount || 0) + 1;
    this.notifyStateChange();
  };
};
