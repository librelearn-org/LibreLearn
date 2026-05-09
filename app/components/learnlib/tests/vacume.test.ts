// TODO: echte test harnes maken!! dit is sketch.
import { expect, test, describe, it } from "bun:test";
import learnLib from "..";
import { testlijst } from "./data";
import assert from "node:assert";
import { defaultLearnConfig } from "../types";

function checkAwnser(qestion: string, antwoordUNSAFE: string): boolean {
  let goedAntwoord = qestion.toLowerCase().trim();
  let antwoord = antwoordUNSAFE.toLowerCase().trim();
  console.log("checking answer", { goedAntwoord, antwoord });
  let isCorrect: boolean = false;
  if (defaultLearnConfig.fuckFransen) {
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
  if (defaultLearnConfig.staAlternatieveAntwoordenToe && goedAntwoord.includes(" / ")) {
    // gebruik recursie.
    const mogelijkeAntwoorden = goedAntwoord.split(" / ");
    console.log("checking alternative answers", mogelijkeAntwoorden);
    for (let mogelijkAntwoord of mogelijkeAntwoorden) {
      if (checkAwnser(mogelijkAntwoord, antwoord)) {
        isCorrect = true;
        console.log("checking alternative answers, is correct?", isCorrect);
        break;
      }
    }
  }
  // als we er hier nog niet uit zijn, dan checken we of het aan () ligt
  if (defaultLearnConfig.optioneleAntwoordDelen && goedAntwoord.includes("(")) {
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

describe("checkAwnser", () => {
  it("checkAwnser should return true for exact match", () => {
    assert.strictEqual(checkAwnser("Paris", "Paris"), true);
  });

  it("checkAwnser should return false for non-matching answer", () => {
    assert.strictEqual(checkAwnser("Paris", "Lyon"), false);
  });

  it("checkAwnser should ignore case and whitespace", () => {
    assert.strictEqual(checkAwnser("  Paris  ", "paris "), true);
  });

  it("checkAwnser should handle alternative answers", () => {
    assert.strictEqual(checkAwnser("Paris / Lyon", "Lyon"), true);
    assert.strictEqual(checkAwnser("Paris / Lyon", "Paris"), true);
    assert.strictEqual(checkAwnser("Paris / Lyon", "Marseille"), false);
  });

  it("checkAwnser should handle optional parts", () => {
    assert.strictEqual(checkAwnser("Par(is)", "Par"), true);
    assert.strictEqual(checkAwnser("Par(is)", "Paris"), true);
    assert.strictEqual(checkAwnser("Par(is)", "Pa"), false);
  });

  it("checkAwnser should handle both alternative answers and optional parts", () => {
    assert.strictEqual(checkAwnser("Par(is) / Ly(on)", "Par"), true);
    assert.strictEqual(checkAwnser("Par(is) / Ly(on)", "Paris"), true);
    assert.strictEqual(checkAwnser("Par(is) / Ly(on)", "Ly"), true);
    assert.strictEqual(checkAwnser("Par(is) / Ly(on)", "Lyon"), true);
    assert.strictEqual(checkAwnser("Par(is) / Ly(on)", "Marseille"), false);
  });

  it("We should handle fuckFransen config", () => {
    const originalConfig = { ...defaultLearnConfig };
    defaultLearnConfig.fuckFransen = true;
    assert.strictEqual(checkAwnser("Café", "Cafe"), true);
    assert.strictEqual(checkAwnser("Café", "Café"), true);
    assert.strictEqual(checkAwnser("Café", "cafE"), true);
    assert.strictEqual(checkAwnser("Café", "Tea"), false);
    defaultLearnConfig.fuckFransen = originalConfig.fuckFransen; // reset config after test
  });
});