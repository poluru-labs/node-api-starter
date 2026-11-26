export const riskLevels = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const approvalStatuses = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export interface ApprovalDecision {
  readonly reviewer: string;
  readonly decision: 'approve' | 'reject';
  readonly reason: string;
  readonly at: string;
}

export interface ApprovalRequest {
  readonly id: string;
  readonly actor: string;
  readonly action: string;
  readonly summary: string;
  readonly risk: RiskLevel;
  readonly status: ApprovalStatus;
  readonly payload: Record<string, unknown>;
  readonly decisions: readonly ApprovalDecision[];
  readonly createdAt: string;
}

export type DecisionResult =
  | { readonly ok: true; readonly request: ApprovalRequest }
  | { readonly ok: false; readonly error: 'already_decided' | 'reason_required' };

const secretKey = /secret|token|password|authorization|api[-_]?key|credential/i;

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === 'string' && riskLevels.some((risk) => risk === value);
}

export function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return typeof value === 'string' && approvalStatuses.some((status) => status === value);
}

export function openRequest(
  input: {
    readonly actor: string;
    readonly action: string;
    readonly summary: string;
    readonly risk: RiskLevel;
    readonly payload: unknown;
  },
  id: string,
  createdAt: string,
): ApprovalRequest {
  const payload = redactPayload(input.payload);
  const base = {
    id,
    actor: input.actor,
    action: input.action,
    summary: input.summary,
    risk: input.risk,
    payload,
    createdAt,
  };
  if (input.risk === 'low') {
    return {
      ...base,
      status: 'approved',
      decisions: [
        {
          reviewer: 'policy',
          decision: 'approve',
          reason: 'Low risk matches the auto-approval policy.',
          at: createdAt,
        },
      ],
    };
  }
  return { ...base, status: 'pending', decisions: [] };
}

export function applyDecision(
  request: ApprovalRequest,
  reviewer: string,
  decision: 'approve' | 'reject',
  reason: string,
  at: string,
): DecisionResult {
  if (request.status !== 'pending') {
    return { ok: false, error: 'already_decided' };
  }
  const text = reason.trim();
  const needsReason =
    decision === 'reject' || (decision === 'approve' && request.risk === 'critical');
  const minimum = decision === 'reject' ? 3 : 12;
  if (needsReason && text.length < minimum) {
    return { ok: false, error: 'reason_required' };
  }
  const status: ApprovalStatus = decision === 'approve' ? 'approved' : 'rejected';
  return {
    ok: true,
    request: {
      ...request,
      status,
      decisions: [...request.decisions, { reviewer, decision, reason: text, at }],
    },
  };
}

export function redactPayload(value: unknown, depth = 0): Record<string, unknown> {
  if (!isPlainRecord(value) || depth > 6) {
    return {};
  }
  const payload: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (secretKey.test(key)) {
      payload[key] = '[redacted]';
    } else if (isPlainRecord(item)) {
      payload[key] = redactPayload(item, depth + 1);
    } else if (Array.isArray(item)) {
      payload[key] = item.slice(0, 20).map((entry) => redactValue(entry, depth + 1));
    } else {
      payload[key] = redactValue(item, depth + 1);
    }
  }
  return payload;
}

function redactValue(value: unknown, depth: number): unknown {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => redactValue(entry, depth + 1));
  }
  if (isPlainRecord(value)) {
    return redactPayload(value, depth);
  }
  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
