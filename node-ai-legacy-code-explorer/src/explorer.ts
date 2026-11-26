export interface SourceFile {
  readonly path: string;
  readonly content: string;
}

export interface CodeFinding {
  readonly rule: 'long-file' | 'long-function' | 'deep-nesting' | 'todo' | 'goto';
  readonly path: string;
  readonly line: number;
  readonly message: string;
}

export interface ExplorationReport {
  readonly id: string;
  readonly method: 'lexical-scan';
  readonly fileCount: number;
  readonly dependencies: readonly string[];
  readonly findings: readonly CodeFinding[];
}

const importPatterns = [
  /import\s+(?:[^'";]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  /#include\s*[<"]([^>"]+)[>"]/g,
  /^(?:from|import)\s+([A-Za-z0-9_.]+)/gm,
];

export function exploreFiles(files: readonly SourceFile[], id: string): ExplorationReport {
  const findings: CodeFinding[] = [];
  const dependencies = new Set<string>();
  for (const file of files) {
    const lines = file.content.split('\n');
    if (lines.length > 400) {
      findings.push({
        rule: 'long-file',
        path: file.path,
        line: 1,
        message: `${file.path} is longer than 400 lines.`,
      });
    }
    scanFunctions(findings, file.path, lines);
    const depth = maxBraceDepth(file.content);
    if (depth.depth >= 6) {
      findings.push({
        rule: 'deep-nesting',
        path: file.path,
        line: depth.line,
        message: `${file.path} reaches brace depth ${String(depth.depth)}.`,
      });
    }
    lines.forEach((line, index) => {
      if (/\b(TODO|FIXME|HACK)\b/.test(line)) {
        findings.push({
          rule: 'todo',
          path: file.path,
          line: index + 1,
          message: `${file.path} still has TODO, FIXME, or HACK.`,
        });
      }
      if (/^\s*goto\s+[A-Za-z_]/.test(line)) {
        findings.push({
          rule: 'goto',
          path: file.path,
          line: index + 1,
          message: `${file.path} uses goto.`,
        });
      }
    });
    for (const name of readDependencies(file.content)) {
      dependencies.add(name);
    }
  }
  return {
    id,
    method: 'lexical-scan',
    fileCount: files.length,
    dependencies: [...dependencies].sort((left, right) => left.localeCompare(right)),
    findings,
  };
}

function scanFunctions(findings: CodeFinding[], path: string, lines: readonly string[]): void {
  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (/^\s*(?:export\s+)?(?:async\s+)?function\s+\w+|^\s*def\s+\w+/.test(line)) {
      starts.push(index);
    }
  });
  starts.forEach((start, index) => {
    const end = starts[index + 1] ?? lines.length;
    if (end - start > 80) {
      findings.push({
        rule: 'long-function',
        path,
        line: start + 1,
        message: `A function in ${path} is longer than 80 lines.`,
      });
    }
  });
}

function maxBraceDepth(content: string): { depth: number; line: number } {
  let depth = 0;
  let max = 0;
  let line = 1;
  let maxLine = 1;
  let quote: string | null = null;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '\n') {
      line += 1;
    }
    if (quote !== null) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      depth += 1;
      if (depth > max) {
        max = depth;
        maxLine = line;
      }
    } else if (char === '}' && depth > 0) {
      depth -= 1;
    }
  }
  return { depth: max, line: maxLine };
}

function readDependencies(content: string): string[] {
  const names: string[] = [];
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const name = match[1];
      if (name !== undefined && name.length > 0 && name.length <= 200) {
        names.push(name);
      }
    }
  }
  return names;
}
