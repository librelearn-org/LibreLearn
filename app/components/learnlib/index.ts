// TODO: dit loskoppelen van react, het zou moeten werken aleen de namen van wat dingen moeten anders
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
  private checkAwnser(qestion: string, antwoordUNSAFE: string): boolean {
    let goedAntwoord = qestion.toLowerCase().trim();
    let antwoord = antwoordUNSAFE.toLowerCase().trim();
    console.log("checking answer", { goedAntwoord, antwoord });
    let isCorrect: boolean = false;
    if (this.config.fuckFransen) {
      // dit is wrm antwoord schrijfbaar is 
      goedAntwoord = goedAntwoord
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
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
      console.log("checking alternative answers", mogelijkeAntwoorden);
      for (let mogelijkAntwoord of mogelijkeAntwoorden) {
        if (this.checkAwnser(mogelijkAntwoord, antwoord)) {
          isCorrect = true;
          console.log("checking alternative answers, is correct?", isCorrect);
          break;
        }
      }
    }
    // als we er hier nog niet uit zijn, dan checken we of het aan () ligt
    if (this.config.optioneleAntwoordDelen && goedAntwoord.includes("(")) {
      // regex D:
      const antwoordZonderOptioneel = goedAntwoord.replace(/\([^)]*\)/g, "").trim();
      const antwoordMetOptioneel = goedAntwoord.replace(/[()]/g, "").trim();
      if (antwoord === antwoordZonderOptioneel || antwoord === antwoordMetOptioneel) {
        isCorrect = true;
      }
      console.log("checking optional parts, is correct?", isCorrect);
    }
    console.log("antwoord is", isCorrect ? "goed" : "fout");
    return isCorrect;
  }

  public antwoord(antwoord: string, overRuleCorrect?: boolean) {
    const currentItemId = this.wachtrij[0];
    const currentItem = this.lijst[currentItemId];
    if (!currentItem) {
      throw new Error("Er is geen current item in de antwoord functie. knap!");
    }
    const isCorrect = this.checkAwnser(currentItem.antwoord.toLowerCase().trim(), antwoord) || overRuleCorrect || false;
    if (currentItem.listSessionItemAnswerHistories === undefined) {
      currentItem.listSessionItemAnswerHistories = [];
    }
    currentItem.listSessionItemAnswerHistories.push({
      antwoord,
      goed: isCorrect,
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
