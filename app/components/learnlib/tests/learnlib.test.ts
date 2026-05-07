import { expect, test, describe } from "bun:test";
import learnLibReact from "..";
import { testlijst } from "./data";
import assert from "node:assert";
describe("Basic usage", () => {
  test("reshuffel", () => {
    const lijst = new learnLibReact(testlijst, {})
    const lijstPreshuffel = { ...(lijst as any).list() };
    lijst.reshuffle()
    expect((lijst as any).list()).not.toBe(lijstPreshuffel);
  });
  test("Custom ID voor lijstItem", () => {
    const lijst = new learnLibReact(testlijst, {});
    const customIddata = testlijst.find((value) => value.id === 'customId');
    expect(customIddata, 'de test id item niet gevonden. is de data.ts veranderd?').not.toBeUndefined()
    assert(customIddata, 'item not found')
    expect((lijst as any).list()['customId']).toBe(customIddata)
  })
});
