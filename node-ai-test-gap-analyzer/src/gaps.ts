export interface SourceFile {
  readonly path: string;
  readonly content: string;
}

export interface TestGap {
  readonly path: string;
  readonly name: string;
}

export interface GapReport {
  readonly id: string;
  readonly method: 'name-reference';
  readonly functionCount: number;
  readonly coveredCount: number;
  readonly coverage: number;
  readonly gaps: readonly TestGap[];
}

export function analyzeGaps(files: readonly SourceFile[], id: string): GapReport {
  const tests = files.filter((file) => isTestFile(file.path));
  const gaps: TestGap[] = [];
  let functionCount = 0;
  for (const file of files) {
    if (isTestFile(file.path)) {
      continue;
    }
    for (const name of functionNames(file.content)) {
      functionCount += 1;
      const covered = tests.some((testFile) =>
        new RegExp(`\\b${escapeRegExp(name)}\\b`).test(testFile.content),
      );
      if (!covered) {
        gaps.push({ path: file.path, name });
      }
    }
  }
  const coveredCount = functionCount - gaps.length;
  return {
    id,
    method: 'name-reference',
    functionCount,
    coveredCount,
    coverage: functionCount === 0 ? 0 : round4(coveredCount / functionCount),
    gaps,
  };
}

function functionNames(content: string): string[] {
  const names = new Set<string>();
  for (const match of content.matchAll(/\b(?:function|def|func)\s+([A-Za-z_]\w*)/g)) {
    const name = match[1];
    if (name !== undefined) {
      names.add(name);
    }
  }
  return [...names];
}

function isTestFile(path: string): boolean {
  return (
    /(\.|_)(test|spec)\.[A-Za-z0-9]+$/.test(path) ||
    path.includes('/__tests__/') ||
    path.startsWith('test/')
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
