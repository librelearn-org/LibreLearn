"client only";
import { defaultLearnConfig, type LearnConfig, type Lijst, type LijstItem } from "./types";
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

  constructor(lijst: Lijst, config?: LearnConfig) {
    lijst.forEach((value: LijstItem) => {
      if (!value.id) {
        value.id = crypto.randomUUID();
      };
      this.lijst[value.id] = value;
      this.wachtrij.push(value.id);
    });
    if (!config) {
      config = defaultLearnConfig;
    }
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
      console.log("notifying state change...");
      console.log("state:", {
        lijst: this.lijst,
        wachtrij: this.wachtrij,
        config: this.config,
      });
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
    console.log("reshuffling...");
    // we resten de wachtrij
    this.wachtrij = [];
    // we bouwen een nieuwe lijst randomly geshuffled
    const items = Object.values(this.lijst);
    shuffle(items);
    items.forEach((item) => {
      this.wachtrij.push(item.id!);
      // we resetten ook de round count en antwoord geschiedenis van elk item
      item.roundCount = 0;
      item.listSessionItemAnswerHistories = [];
    });
    this.notifyStateChange();
  };
  private checkAwnser(antwoordUNSAFE: string): boolean {
    const currentItemId = this.wachtrij[0];
    const currentItem = this.lijst[currentItemId];
    const goedAntwoord = currentItem.antwoord.toLowerCase().trim();
    let antwoord = antwoordUNSAFE.toLowerCase().trim();
    let isCorrect: boolean = false;
    if (!currentItem) {
      throw new Error("Er is geen current item in de antwoord functie. knap!");
    }
    if (this.config.fuckFransen) {
      // dit is wrm antwoord schrijfbaar is 
      antwoord = antwoord
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }
    if (antwoord === goedAntwoord) {
      return true;
    }
    if (this.config.staAlternatieveAntwoordenToe && goedAntwoord.includes(" / ")) {
      // gebruik recursie.
      const mogelijkeAntwoorden = goedAntwoord.split(" / ");
      for (let mogelijkAntwoord of mogelijkeAntwoorden) {
        if (this.checkAwnser(mogelijkAntwoord)) {
          return true;
        }
      }
    }
    // als we er hier nog niet uit zijn, dan checken we of het aan () ligt
    if (this.config.optioneleAntwoordDelen && goedAntwoord.includes("(")) {
      // regex D:
      this.checkAwnser(goedAntwoord.replace(/\(.*?\)/g, ""));
    }
    return isCorrect;
  }

  public antwoord(antwoord: string, overRuleCorrect?: boolean) {
    const currentItemId = this.wachtrij[0];
    const currentItem = this.lijst[currentItemId];
    if (!currentItem) {
      throw new Error("Er is geen current item in de antwoord functie. knap!");
    }
    const isCorrect = antwoord === currentItem.antwoord;
    if (currentItem.listSessionItemAnswerHistories === undefined) {
      currentItem.listSessionItemAnswerHistories = [];
    }
    currentItem.listSessionItemAnswerHistories.push({
      antwoord,
      goed: this.checkAwnser(antwoord) || overRuleCorrect || false,
      round: currentItem.roundCount || 0,
    });
    console.log("listSessionItemAnswerHistories", currentItem.listSessionItemAnswerHistories);
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
