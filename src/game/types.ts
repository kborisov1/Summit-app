/** Rarity tier, 1 (common) to 5 (legendary). See scope "Altitude Scoring". */
export type Rarity = 1 | 2 | 3 | 4 | 5;

export interface Answer {
  canonical: string;
  aliases?: string[];
  rarity: Rarity;
}

export interface Prompt {
  id: string;
  question: string;
  answers: Answer[];
  /** Near misses that must be rejected even if they are close to an accepted answer. */
  wrongAnswers?: string[];
}

export interface PromptSet {
  id: string;
  /** Free-form note for content authors. Not shown to players. */
  note?: string;
  prompts: Prompt[];
}
