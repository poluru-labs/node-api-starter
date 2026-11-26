export const riskLevels = ['low', 'medium', 'high'] as const;
export type RiskLevel = (typeof riskLevels)[number];

export interface ToolDefinition {
  readonly id: string;
  readonly name: string;
  readonly risk: RiskLevel;
  readonly scopes: readonly string[];
}

export interface PermissionDecision {
  readonly method: 'scope-and-risk';
  readonly tool: string;
  readonly decision: 'allow' | 'deny' | 'require_approval';
  readonly reason:
    'allowed' | 'unknown_tool' | 'missing_scope' | 'risk_exceeded' | 'approval_required';
}

const riskRank: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === 'string' && riskLevels.some((risk) => risk === value);
}

export function decidePermission(
  tool: ToolDefinition | undefined,
  requestedName: string,
  requestedScopes: readonly string[],
  maxRisk: RiskLevel,
): PermissionDecision {
  if (tool === undefined) {
    return decision(requestedName, 'deny', 'unknown_tool');
  }
  if (requestedScopes.some((scope) => !tool.scopes.includes(scope))) {
    return decision(tool.name, 'deny', 'missing_scope');
  }
  if (riskRank[tool.risk] > riskRank[maxRisk]) {
    return decision(tool.name, 'deny', 'risk_exceeded');
  }
  if (tool.risk === 'high') {
    return decision(tool.name, 'require_approval', 'approval_required');
  }
  return decision(tool.name, 'allow', 'allowed');
}

function decision(
  tool: string,
  outcome: PermissionDecision['decision'],
  reason: PermissionDecision['reason'],
): PermissionDecision {
  return { method: 'scope-and-risk', tool, decision: outcome, reason };
}
