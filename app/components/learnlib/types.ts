

export type Lijst = LijstItem[]
export type LijstItem = {
  vraag: string,
  antwoord: string,
  listSessionItemAnswerHistories?: {
    round: number,
    goed: boolean,
    antwoord: string,
    // deze gebruiken we niet maar houden typescript blij zonder 
    // dat we de lijst moeten omzetten naar een andere vorm
    // zelfde geldt voor de naam van deze ding
    listSessionItem?: any,
    listSessionItemId?: any,
    id?: string
  }[],
  roundCount: number,
  id?: string // een voorstel voor de interne id van de lijst

  // ts blij houden
  listSession?: any,
  listSessionId?: any,
}
export type LearnConfig = {
  staAlternatieveAntwoordenToe?: boolean
  multikeuzeWisselAlternatieveAntwoordenAf?: boolean
  gebruikAlternatieveVragenAfwisselendWanneerBeschikbaar?: boolean,
  gebruikSeed?: string, // anders random
}
