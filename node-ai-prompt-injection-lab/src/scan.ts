export const channels = ['user', 'retrieved', 'tool'] as const;
export type Channel = (typeof channels)[number];

export type ScanSeverity = 'moderate' | 'high';

export interface ScanFinding {
  readonly code: 'instruction_override' | 'role_hijack' | 'prompt_exfiltration' | 'delimiter_spoof';
  readonly severity: ScanSeverity;
  readonly message: string;
}

export interface ScanReport {
  readonly id: string;
  readonly channel: Channel;
  readonly method: 'pattern-scan';
  readonly risk: 'none' | ScanSeverity;
  readonly action: 'allow' | 'review' | 'block';
  readonly findings: readonly ScanFinding[];
}

const detectors: readonly (readonly [ScanFinding['code'], ScanSeverity, RegExp, string])[] = [
  [
    'instruction_override',
    'high',
    /\b(?:ignore|disregard)\b(?:\s+\w+){0,3}\s+\b(?:previous|above|prior)\b(?:\s+\w+){0,3}\s+\b(?:instructions|prompts|rules)\b/i,
    'The text tells the model to ignore earlier instructions.',
  ],
  ['role_hijack', 'high', /\byou are now\b/i, 'The text tries to replace the model role.'],
  [
    'prompt_exfiltration',
    'high',
    /\b(?:reveal|print|show|repeat)\b[\s\S]{0,40}?\b(?:system prompt|hidden prompt|initial instructions)\b/i,
    'The text asks for hidden instructions.',
  ],
  [
    'delimiter_spoof',
    'moderate',
    /<\|im_start\|>|\[INST\]|###\s*system\b/i,
    'The text imitates a chat control token.',
  ],
];

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && channels.some((channel) => channel === value);
}

export function scanText(channel: Channel, text: string, id: string): ScanReport {
  const findings: ScanFinding[] = [];
  for (const [code, severity, pattern, message] of detectors) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      findings.push({ code, severity, message });
    }
  }
  let risk: ScanReport['risk'] = 'none';
  if (findings.some((finding) => finding.severity === 'high')) {
    risk = 'high';
  } else if (findings.length > 0) {
    risk = 'moderate';
  }
  let action: ScanReport['action'] = 'allow';
  if (risk === 'high') {
    action = 'block';
  } else if (risk === 'moderate') {
    action = 'review';
  }
  return { id, channel, method: 'pattern-scan', risk, action, findings };
}
