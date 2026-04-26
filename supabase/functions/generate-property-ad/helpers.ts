export const MODEL_PRICING: Record<string, [number, number]> = {
  'claude-sonnet-4-6': [3.0, 15.0],
  'claude-opus-4-7': [15.0, 75.0],
  'claude-haiku-4-5-20251001': [0.8, 4.0],
  'gpt-4o': [2.5, 10.0],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-5': [15.0, 60.0],
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const [inputRate, outputRate] = MODEL_PRICING[model] ?? [3.0, 15.0]
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate
}
