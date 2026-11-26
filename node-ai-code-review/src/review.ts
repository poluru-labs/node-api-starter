export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

export interface ReviewFinding {
  readonly path: string;
  readonly rule: string;
  readonly severity: Severity;
  readonly line: number;
  readonly message: string;
}

export interface ReviewReport {
  readonly id: string;
  readonly score: number;
  readonly findings: readonly ReviewFinding[];
}

const weights: Record<Severity, number> = {
  critical: 25,
  serious: 15,
  moderate: 8,
  minor: 3,
};

export function reviewFiles(
  files: readonly { readonly path: string; readonly content: string }[],
  id: string,
): ReviewReport {
  const findings: ReviewFinding[] = [];
  for (const file of files) {
    const lines = file.content.split('\n');
    const script = /\.(?:js|mjs|cjs|ts|tsx|jsx)$/i.test(file.path);
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (
        /AKIA[0-9A-Z]{16}/.test(line) ||
        /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(line)
      ) {
        findings.push(
          finding(file.path, 'secret', 'critical', lineNumber, 'Possible secret in source.'),
        );
      } else if (/(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i.test(line)) {
        findings.push(
          finding(file.path, 'secret', 'critical', lineNumber, 'Possible secret in source.'),
        );
      }
      if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(line)) {
        findings.push(
          finding(
            file.path,
            'eval',
            'serious',
            lineNumber,
            'Dynamic code execution is hard to review.',
          ),
        );
      }
      if (/\bdebugger\b/.test(line)) {
        findings.push(
          finding(
            file.path,
            'debugger',
            'moderate',
            lineNumber,
            'debugger statement left in source.',
          ),
        );
      }
      if (script && /(?<![=!])==(?!=)/.test(line)) {
        findings.push(finding(file.path, 'loose-equality', 'moderate', lineNumber, 'Prefer ===.'));
      }
      if (script && /\bconsole\.log\s*\(/.test(line)) {
        findings.push(
          finding(file.path, 'console', 'minor', lineNumber, 'console.log left in source.'),
        );
      }
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line) || /catch\s*\{\s*\}/.test(line)) {
        findings.push(
          finding(file.path, 'empty-catch', 'serious', lineNumber, 'Empty catch hides failures.'),
        );
      }
      if (line.length > 120) {
        findings.push(
          finding(
            file.path,
            'long-line',
            'minor',
            lineNumber,
            'Line is longer than 120 characters.',
          ),
        );
      }
    });
    if (lines.length > 400) {
      findings.push(
        finding(file.path, 'long-file', 'moderate', 1, 'File is longer than 400 lines.'),
      );
    }
  }
  const penalty = findings.reduce((total, item) => total + weights[item.severity], 0);
  return { id, score: Math.max(0, 100 - penalty), findings };
}

function finding(
  path: string,
  rule: string,
  severity: Severity,
  line: number,
  message: string,
): ReviewFinding {
  return { path, rule, severity, line, message };
}
