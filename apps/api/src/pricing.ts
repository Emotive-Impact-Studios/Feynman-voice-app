// Prices are in US dollars per million tokens. The defaults are the
// introductory figures from the project brief and are meant to be overridden
// with environment variables once the real price list is confirmed.
// Google has charged more for audio input than text on earlier Flash models,
// so GEMINI_PRICE_IN_AUDIO is kept separate on purpose.

export interface Prices {
  inTextPerM: number;
  inAudioPerM: number;
  outPerM: number;
  gbpPerUsd: number;
}

export function pricesFromEnv(env: Record<string, string | undefined> = process.env): Prices {
  const n = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);
  return {
    inTextPerM: n(env.GEMINI_PRICE_IN_TEXT, 0.75),
    inAudioPerM: n(env.GEMINI_PRICE_IN_AUDIO, 0.75),
    outPerM: n(env.GEMINI_PRICE_OUT, 3.75),
    gbpPerUsd: n(env.GBP_PER_USD, 0.76),
  };
}

export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
  promptTokensDetails?: { modality: string; tokenCount: number }[];
}

export interface TurnCost {
  audioInTokens: number;
  textInTokens: number;
  outTokens: number;
  usd: number;
  pence: number;
}

export function costOf(usage: GeminiUsage, prices: Prices): TurnCost {
  const prompt = usage.promptTokenCount ?? 0;
  const audioInTokens =
    usage.promptTokensDetails?.filter((d) => d.modality === "AUDIO").reduce((n, d) => n + d.tokenCount, 0) ?? 0;
  const textInTokens = Math.max(0, prompt - audioInTokens);
  // Thinking tokens are billed at the output rate.
  const outTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  const usd =
    (audioInTokens * prices.inAudioPerM + textInTokens * prices.inTextPerM + outTokens * prices.outPerM) / 1e6;
  return { audioInTokens, textInTokens, outTokens, usd, pence: usd * prices.gbpPerUsd * 100 };
}
