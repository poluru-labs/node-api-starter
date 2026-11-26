export const blockTypes = ['heading', 'paragraph', 'image', 'table', 'link', 'list'] as const;
export type BlockType = (typeof blockTypes)[number];

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface DocumentBlock {
  readonly type: BlockType;
  readonly text: string | null;
  readonly level: number | null;
  readonly alt: string | null;
  readonly hasHeader: boolean | null;
  readonly href: string | null;
}

export interface DocumentPage {
  readonly number: number;
  readonly blocks: readonly DocumentBlock[];
}

export interface DocumentModel {
  readonly title: string | null;
  readonly language: string | null;
  readonly pages: readonly DocumentPage[];
}

export interface DocumentFinding {
  readonly rule: string;
  readonly impact: Impact;
  readonly criterion: string;
  readonly page: number | null;
  readonly message: string;
}

export interface DocumentReport {
  readonly id: string;
  readonly score: number;
  readonly findings: readonly DocumentFinding[];
}

const impactWeight: Record<Impact, number> = {
  critical: 25,
  serious: 15,
  moderate: 8,
  minor: 3,
};

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && blockTypes.some((type) => type === value);
}

export function checkDocument(document: DocumentModel, id: string): DocumentReport {
  const findings: DocumentFinding[] = [];
  if (document.title === null || document.title.trim().length === 0) {
    findings.push(
      finding('document-title', 'critical', '2.4.2', null, 'The document needs a non-empty title.'),
    );
  }
  if (document.language === null || !/^[a-z]{2}(?:-[A-Za-z0-9]+)?$/.test(document.language)) {
    findings.push(
      finding(
        'document-language',
        'critical',
        '3.1.1',
        null,
        'The document needs a language tag such as en.',
      ),
    );
  }

  const headingLevels: number[] = [];
  for (const page of [...document.pages].sort((left, right) => left.number - right.number)) {
    if (page.blocks.length === 0) {
      findings.push(
        finding('empty-page', 'minor', '1.3.1', page.number, 'The page has no content blocks.'),
      );
    }
    for (const block of page.blocks) {
      inspectBlock(findings, headingLevels, page.number, block);
    }
  }

  if (headingLevels.length > 0 && headingLevels[0] !== 1) {
    findings.push(
      finding('heading-start', 'moderate', '1.3.1', null, 'The first heading should be level 1.'),
    );
  }

  const score = Math.max(
    0,
    100 - findings.reduce((total, item) => total + impactWeight[item.impact], 0),
  );
  return { id, score, findings };
}

function inspectBlock(
  findings: DocumentFinding[],
  headingLevels: number[],
  page: number,
  block: DocumentBlock,
): void {
  if (block.type === 'heading') {
    const level = block.level ?? 0;
    const previous = headingLevels[headingLevels.length - 1];
    if (previous !== undefined && level > previous + 1) {
      findings.push(
        finding(
          'heading-order',
          'serious',
          '1.3.1',
          page,
          `Heading level ${String(level)} skips level ${String(previous + 1)}.`,
        ),
      );
    }
    headingLevels.push(level);
    if (block.text === null || block.text.trim().length === 0) {
      findings.push(
        finding('heading-name', 'serious', '2.4.6', page, 'A heading needs visible text.'),
      );
    }
    return;
  }

  if (block.type === 'image') {
    if (block.alt === null) {
      findings.push(
        finding('image-alt', 'critical', '1.1.1', page, 'An image needs alternative text.'),
      );
      return;
    }
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(block.alt.trim())) {
      findings.push(
        finding(
          'image-alt-filename',
          'moderate',
          '1.1.1',
          page,
          'Alternative text should describe the image, not name the file.',
        ),
      );
    }
    return;
  }

  if (block.type === 'table' && block.hasHeader !== true) {
    findings.push(
      finding('table-header', 'serious', '1.3.1', page, 'A data table needs a header row.'),
    );
    return;
  }

  if (block.type === 'link') {
    if (block.text === null || block.text.trim().length === 0) {
      findings.push(
        finding(
          'link-name',
          'serious',
          '2.4.4',
          page,
          'A link needs text that says where it goes.',
        ),
      );
    }
    if (block.href === null || block.href.trim().length === 0 || /^javascript:/i.test(block.href)) {
      findings.push(
        finding('link-target', 'serious', '2.4.4', page, 'A link needs a real destination.'),
      );
    }
  }
}

function finding(
  rule: string,
  impact: Impact,
  criterion: string,
  page: number | null,
  message: string,
): DocumentFinding {
  return { rule, impact, criterion, page, message };
}
