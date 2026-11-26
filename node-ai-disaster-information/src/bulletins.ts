export const disasterEvents = [
  'flood',
  'wildfire',
  'earthquake',
  'tornado',
  'winter-storm',
  'heat',
] as const;
export type DisasterEvent = (typeof disasterEvents)[number];

export const severities = ['extreme', 'severe', 'moderate', 'minor', 'unknown'] as const;
export type BulletinSeverity = (typeof severities)[number];

export const urgencies = ['immediate', 'expected', 'future', 'past'] as const;
export type Urgency = (typeof urgencies)[number];

export const certainties = ['observed', 'likely', 'possible', 'unlikely'] as const;
export type Certainty = (typeof certainties)[number];

export interface Bulletin {
  readonly id: string;
  readonly event: DisasterEvent;
  readonly severity: BulletinSeverity;
  readonly urgency: Urgency;
  readonly certainty: Certainty;
  readonly area: string;
  readonly headline: string;
  readonly instruction: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface Guidance {
  readonly area: string;
  readonly event: DisasterEvent | null;
  readonly at: string;
  readonly source: 'bulletin' | 'standard';
  readonly bulletins: readonly Bulletin[];
  readonly actions: readonly string[];
}

const severityRank: Record<BulletinSeverity, number> = {
  extreme: 4,
  severe: 3,
  moderate: 2,
  minor: 1,
  unknown: 0,
};

const certaintyRank: Record<Certainty, number> = {
  observed: 3,
  likely: 2,
  possible: 1,
  unlikely: 0,
};

const protectiveActions: Record<DisasterEvent, readonly string[]> = {
  flood: [
    'Move to higher ground.',
    'Do not walk or drive through flood water.',
    'Follow instructions from local officials.',
  ],
  wildfire: [
    'Leave if officials tell you to evacuate.',
    'Close windows and stay away from the fire front.',
    'Follow instructions from local officials.',
  ],
  earthquake: [
    'Drop, cover, and hold on until the shaking stops.',
    'Stay away from windows and heavy furniture.',
    'Follow instructions from local officials.',
  ],
  tornado: [
    'Go to a small interior room on the lowest floor.',
    'Stay away from windows.',
    'Follow instructions from local officials.',
  ],
  'winter-storm': [
    'Stay off roads if travel is not necessary.',
    'Keep warm and check on nearby people.',
    'Follow instructions from local officials.',
  ],
  heat: [
    'Stay in a cool place and drink water.',
    'Limit outdoor activity during the hottest hours.',
    'Follow instructions from local officials.',
  ],
};

export function isDisasterEvent(value: unknown): value is DisasterEvent {
  return typeof value === 'string' && disasterEvents.some((event) => event === value);
}

export function isBulletinSeverity(value: unknown): value is BulletinSeverity {
  return typeof value === 'string' && severities.some((severity) => severity === value);
}

export function isUrgency(value: unknown): value is Urgency {
  return typeof value === 'string' && urgencies.some((urgency) => urgency === value);
}

export function isCertainty(value: unknown): value is Certainty {
  return typeof value === 'string' && certainties.some((certainty) => certainty === value);
}

export function guide(
  bulletins: readonly Bulletin[],
  area: string,
  event: DisasterEvent | null,
  at: string,
): Guidance {
  const moment = Date.parse(at);
  const active = bulletins
    .filter((bulletin) => bulletin.area === area)
    .filter((bulletin) => event === null || bulletin.event === event)
    .filter((bulletin) => Date.parse(bulletin.expiresAt) > moment)
    .sort((left, right) => {
      const bySeverity = severityRank[right.severity] - severityRank[left.severity];
      if (bySeverity !== 0) {
        return bySeverity;
      }
      const byCertainty = certaintyRank[right.certainty] - certaintyRank[left.certainty];
      if (byCertainty !== 0) {
        return byCertainty;
      }
      return right.issuedAt.localeCompare(left.issuedAt);
    });

  const eventKey = event ?? active[0]?.event ?? null;
  const standard = eventKey === null ? [] : protectiveActions[eventKey];
  const actions: string[] = [];
  for (const bulletin of active) {
    pushAction(actions, bulletin.instruction);
  }
  for (const action of standard) {
    pushAction(actions, action);
  }

  return {
    area,
    event,
    at,
    source: active.length > 0 ? 'bulletin' : 'standard',
    bulletins: active,
    actions,
  };
}

function pushAction(actions: string[], action: string): void {
  const text = action.trim();
  if (text.length > 0 && !actions.includes(text) && actions.length < 8) {
    actions.push(text);
  }
}
