export const eventKinds = ['llm', 'tool', 'retrieval', 'handoff'] as const;
export type EventKind = (typeof eventKinds)[number];

export type RunStatus = 'running' | 'completed' | 'error';

export interface TraceEvent {
  readonly id: string;
  readonly kind: EventKind;
  readonly name: string;
  readonly status: 'ok' | 'error';
  readonly durationMs: number;
  readonly tokens: number;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface AgentRun {
  readonly id: string;
  readonly agent: string;
  readonly status: RunStatus;
  readonly startedAt: string;
  readonly events: readonly TraceEvent[];
}

export interface RunSummary {
  readonly id: string;
  readonly agent: string;
  readonly status: RunStatus;
  readonly startedAt: string;
  readonly eventCount: number;
  readonly errorCount: number;
  readonly totalDurationMs: number;
  readonly totalTokens: number;
}

const secretKey = /secret|token|password|authorization|api[-_]?key|credential/i;

export function isEventKind(value: unknown): value is EventKind {
  return eventKinds.some((kind) => kind === value);
}

export function redactAttributes(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const redacted: Record<string, string> = {};
  for (const key of Object.keys(record).sort()) {
    const field = record[key];
    if (typeof field !== 'string' && typeof field !== 'number' && typeof field !== 'boolean') {
      continue;
    }
    redacted[key] = secretKey.test(key) ? '[redacted]' : String(field);
  }
  return redacted;
}

export function summarize(run: AgentRun): RunSummary {
  const errorCount = run.events.filter((event) => event.status === 'error').length;
  return {
    id: run.id,
    agent: run.agent,
    status: run.status,
    startedAt: run.startedAt,
    eventCount: run.events.length,
    errorCount,
    totalDurationMs: run.events.reduce((total, event) => total + event.durationMs, 0),
    totalTokens: run.events.reduce((total, event) => total + event.tokens, 0),
  };
}

export function nextStatus(
  current: RunStatus,
  eventStatus: 'ok' | 'error',
  complete: boolean,
): RunStatus {
  if (current === 'error' || eventStatus === 'error') {
    return 'error';
  }
  return complete ? 'completed' : 'running';
}
