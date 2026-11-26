export const modelTiers = ['small', 'large'] as const;
export type ModelTier = (typeof modelTiers)[number];

export interface ModelCard {
  readonly id: string;
  readonly name: string;
  readonly tier: ModelTier;
  readonly costPer1kTokens: number;
  readonly maxLatencyMs: number;
  readonly capabilities: readonly string[];
  readonly allowsSensitive: boolean;
}

export interface RouteRequest {
  readonly task: string;
  readonly needs: readonly string[];
  readonly sensitive: boolean;
  readonly maxCostPer1k: number | null;
  readonly maxLatencyMs: number | null;
}

export interface RouteDecision {
  readonly method: 'capability-cost';
  readonly matched: Pick<
    ModelCard,
    'id' | 'name' | 'tier' | 'costPer1kTokens' | 'maxLatencyMs'
  > | null;
  readonly reason: 'selected' | 'no_match';
}

export function isModelTier(value: unknown): value is ModelTier {
  return typeof value === 'string' && modelTiers.some((tier) => tier === value);
}

export function chooseModel(models: readonly ModelCard[], request: RouteRequest): RouteDecision {
  const needs = request.needs.map((need) => need.toLowerCase());
  const candidates = models
    .filter((model) => needs.every((need) => model.capabilities.includes(need)))
    .filter((model) => !request.sensitive || model.allowsSensitive)
    .filter(
      (model) => request.maxCostPer1k === null || model.costPer1kTokens <= request.maxCostPer1k,
    )
    .filter((model) => request.maxLatencyMs === null || model.maxLatencyMs <= request.maxLatencyMs)
    .sort(
      (left, right) =>
        left.costPer1kTokens - right.costPer1kTokens ||
        left.maxLatencyMs - right.maxLatencyMs ||
        left.name.localeCompare(right.name),
    );
  const selected = candidates[0];
  if (selected === undefined) {
    return { method: 'capability-cost', matched: null, reason: 'no_match' };
  }
  return {
    method: 'capability-cost',
    reason: 'selected',
    matched: {
      id: selected.id,
      name: selected.name,
      tier: selected.tier,
      costPer1kTokens: selected.costPer1kTokens,
      maxLatencyMs: selected.maxLatencyMs,
    },
  };
}
