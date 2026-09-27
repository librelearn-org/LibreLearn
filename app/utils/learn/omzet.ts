import { type KaartStaat, Phase } from "@siemsiem/learnlib";

export interface LijstItem {
  id?: string;
  vraag: string;
  antwoord: string;
}

/**
 * Converteert een lijst-item naar een nieuwe `KaartStaat` voor Learnlib.
 */
export function omzetNaarKaartStaat(
  item: LijstItem,
  defaultMethodeId: string = "simple",
): KaartStaat {
  const now = new Date();
  return {
    id: item.id ?? "",
    question: item.vraag,
    answer: item.antwoord,
    phase: Phase.Learning,
    methodId: defaultMethodeId,
    lastReviewed: now,
    nextReview: now,
    history: [],
    metadata: {},
  };
}

/**
 * Converteert een lijst van lijst-items naar een array van `KaartStaat`.
 */
export function omzetLijstNaarKaartStaten(
  items: LijstItem[],
  defaultMethodeId: string = "simple",
): KaartStaat[] {
  return items.map((item) => omzetNaarKaartStaat(item, defaultMethodeId));
}
