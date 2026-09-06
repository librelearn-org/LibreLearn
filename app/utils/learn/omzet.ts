import type { KaartSnapshot, KaartStaat } from "@siemsiem/learnlib";

export interface RuwKaartSnapshot {
    kaartId?: string;
    date?: string | Date;
    antwoord?: string;
    goed?: number;
}

export interface RuwKaartItem {
    id?: string;
    vraag: string;
    antwoord: string;
    fase?: number;
    methodeId?: string;
    methode?: string;
    lastReviewed?: string | Date;
    lastReview?: string | Date;
    nextReview?: string | Date;
    history?: RuwKaartSnapshot[];
    metaData?: unknown;
}

/**
 * Converteert een ruw kaart-item (uit een lijst of leersessie) naar een volwaardige `KaartStaat` voor Learnlib.
 */
export function omzetNaarKaartStaat(
    item: RuwKaartItem,
    defaultMethodeId: string = "simple"
): KaartStaat {
    const now = new Date();
    return {
        id: item.id ?? "",
        vraag: item.vraag,
        antwoord: item.antwoord,
        fase: typeof item.fase === "number" ? item.fase : 0,
        methodeId: item.methodeId ?? item.methode ?? defaultMethodeId,
        lastReviewed: item.lastReviewed
            ? new Date(item.lastReviewed)
            : item.lastReview
                ? new Date(item.lastReview)
                : now,
        nextReview: item.nextReview ? new Date(item.nextReview) : now,
        history: Array.isArray(item.history)
            ? item.history.map((h) => ({
                kaartId: h.kaartId ?? item.id ?? "",
                date: h.date ? new Date(h.date) : new Date(),
                antwoord: h.antwoord ?? "",
                goed: (h.goed ?? 0) as KaartSnapshot["goed"],
            }))
            : [],
        metaData:
            item.metaData && typeof item.metaData === "object" && !Array.isArray(item.metaData)
                ? (item.metaData as Record<string, any>)
                : {},
    };
}

/**
 * Converteert een lijst van ruwe kaart-items naar een array van `KaartStaat`.
 */
export function omzetLijstNaarKaartStaten(
    items: RuwKaartItem[],
    defaultMethodeId: string = "simple"
): KaartStaat[] {
    return items.map((item) => omzetNaarKaartStaat(item, defaultMethodeId));
}
