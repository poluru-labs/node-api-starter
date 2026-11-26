export const severities = ['sev1', 'sev2', 'sev3', 'sev4'] as const;
export type IncidentSeverity = (typeof severities)[number];

export const incidentStatuses = ['investigating', 'identified', 'monitoring', 'resolved'] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export const eventKinds = ['deploy', 'alert', 'metric', 'log', 'note'] as const;
export type EventKind = (typeof eventKinds)[number];

export interface IncidentEvent {
  readonly at: string;
  readonly kind: EventKind;
  readonly message: string;
  readonly service: string | null;
  readonly sequence: number;
}

export interface Hypothesis {
  readonly code: 'recent_deploy' | 'error_burst' | 'cross_service';
  readonly confidence: 'high' | 'medium';
  readonly message: string;
}

export interface Incident {
  readonly id: string;
  readonly title: string;
  readonly severity: IncidentSeverity;
  readonly service: string;
  readonly status: IncidentStatus;
  readonly openedAt: string;
  readonly method: 'timeline-correlation';
  readonly events: readonly IncidentEvent[];
  readonly hypotheses: readonly Hypothesis[];
}

const deployWindowMs = 30 * 60 * 1000;
const closeWindowMs = 15 * 60 * 1000;
const errorPattern = /error|fail|exception|timeout/i;

export function isIncidentSeverity(value: unknown): value is IncidentSeverity {
  return typeof value === 'string' && severities.some((severity) => severity === value);
}

export function isIncidentStatus(value: unknown): value is IncidentStatus {
  return typeof value === 'string' && incidentStatuses.some((status) => status === value);
}

export function isEventKind(value: unknown): value is EventKind {
  return typeof value === 'string' && eventKinds.some((kind) => kind === value);
}

export function openIncident(
  title: string,
  severity: IncidentSeverity,
  service: string,
  id: string,
  openedAt: string,
): Incident {
  return {
    id,
    title,
    severity,
    service,
    status: 'investigating',
    openedAt,
    method: 'timeline-correlation',
    events: [],
    hypotheses: [],
  };
}

export function addEvent(incident: Incident, event: IncidentEvent): Incident {
  const events = [...incident.events, event].sort((left, right) => {
    const byTime = left.at.localeCompare(right.at);
    return byTime === 0 ? left.sequence - right.sequence : byTime;
  });
  return { ...incident, events, hypotheses: correlate(incident.service, events) };
}

export function withStatus(incident: Incident, status: IncidentStatus): Incident {
  return { ...incident, status };
}

function correlate(service: string, events: readonly IncidentEvent[]): Hypothesis[] {
  const hypotheses: Hypothesis[] = [];
  const deploys = events.filter((event) => event.kind === 'deploy');
  const alerts = events.filter((event) => event.kind === 'alert');
  const closeDeploy = alerts.some((alert) =>
    deploys.some((deploy) => {
      const gap = Date.parse(alert.at) - Date.parse(deploy.at);
      return gap >= 0 && gap <= closeWindowMs;
    }),
  );
  const recentDeploy = alerts.some((alert) =>
    deploys.some((deploy) => {
      const gap = Date.parse(alert.at) - Date.parse(deploy.at);
      return gap >= 0 && gap <= deployWindowMs;
    }),
  );
  if (recentDeploy) {
    hypotheses.push({
      code: 'recent_deploy',
      confidence: closeDeploy ? 'high' : 'medium',
      message: 'A deploy was recorded within 30 minutes before an alert.',
    });
  }

  const noisy = events.filter(
    (event) => event.kind === 'alert' || (event.kind === 'log' && errorPattern.test(event.message)),
  );
  if (alerts.length >= 3 || noisy.length >= 3) {
    hypotheses.push({
      code: 'error_burst',
      confidence: noisy.length >= 5 || alerts.length >= 5 ? 'high' : 'medium',
      message: 'Several alerts or error logs landed in this timeline.',
    });
  }

  const services = new Set<string>([service]);
  for (const event of events) {
    if (event.service !== null) {
      services.add(event.service);
    }
  }
  if (services.size >= 2) {
    hypotheses.push({
      code: 'cross_service',
      confidence: 'medium',
      message: 'The timeline names more than one service.',
    });
  }
  return hypotheses;
}
