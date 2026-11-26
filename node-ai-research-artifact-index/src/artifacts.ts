export const artifactKinds = ['paper', 'dataset', 'code', 'model', 'protocol'] as const;
export type ArtifactKind = (typeof artifactKinds)[number];

export const licenses = ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'CC0-1.0', 'other'] as const;
export type ArtifactLicense = (typeof licenses)[number];

export const relationTypes = ['cites', 'uses', 'derives'] as const;
export type RelationType = (typeof relationTypes)[number];

export interface ArtifactRelation {
  readonly type: RelationType;
  readonly targetId: string;
}

export interface Artifact {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly version: string;
  readonly license: ArtifactLicense;
  readonly identifier: string;
  readonly summary: string;
  readonly relations: readonly ArtifactRelation[];
}

export interface ArtifactMatch {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly score: number;
}

const stopwords = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

export function isArtifactKind(value: unknown): value is ArtifactKind {
  return typeof value === 'string' && artifactKinds.some((kind) => kind === value);
}

export function isArtifactLicense(value: unknown): value is ArtifactLicense {
  return typeof value === 'string' && licenses.some((license) => license === value);
}

export function isRelationType(value: unknown): value is RelationType {
  return typeof value === 'string' && relationTypes.some((type) => type === value);
}

export function searchArtifacts(
  artifacts: readonly Artifact[],
  query: string,
  kind: ArtifactKind | null,
  limit: number,
): ArtifactMatch[] {
  const terms = tokenize(query);
  return artifacts
    .filter((artifact) => kind === null || artifact.kind === kind)
    .map((artifact) => {
      const title = new Set(tokenize(artifact.title));
      const matched = terms.filter((term) => title.has(term));
      return { id: artifact.id, kind: artifact.kind, title: artifact.title, score: matched.length };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}

export function addRelation(artifact: Artifact, relation: ArtifactRelation): Artifact {
  const exists = artifact.relations.some(
    (item) => item.type === relation.type && item.targetId === relation.targetId,
  );
  if (exists) {
    return artifact;
  }
  return { ...artifact, relations: [...artifact.relations, relation] };
}

function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 2 && !stopwords.has(term)),
    ),
  ];
}
