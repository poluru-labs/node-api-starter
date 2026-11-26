import { createHash } from 'node:crypto';

export interface ProvenanceNode {
  readonly id: string;
  readonly name: string;
  readonly digest: string;
  readonly inputs: readonly { readonly id: string; readonly operation: string }[];
}

export interface LineageEntry {
  readonly id: string;
  readonly name: string;
  readonly digest: string;
  readonly operation: string | null;
  readonly depth: number;
}

const digestPattern = /^[a-f0-9]{64}$/;

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function isDigest(value: unknown): value is string {
  return typeof value === 'string' && digestPattern.test(value);
}

export function upstream(nodes: ReadonlyMap<string, ProvenanceNode>, id: string): LineageEntry[] {
  const origin = nodes.get(id);
  if (origin === undefined) {
    return [];
  }
  const entries: LineageEntry[] = [
    { id: origin.id, name: origin.name, digest: origin.digest, operation: null, depth: 0 },
  ];
  const seen = new Set<string>([id]);
  const queue: { id: string; depth: number }[] = origin.inputs.map((input) => ({
    id: input.id,
    depth: 1,
  }));
  const operationByChild = new Map(origin.inputs.map((input) => [input.id, input.operation]));
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || current.depth > 20 || seen.has(current.id)) {
      continue;
    }
    seen.add(current.id);
    const node = nodes.get(current.id);
    if (node === undefined) {
      continue;
    }
    entries.push({
      id: node.id,
      name: node.name,
      digest: node.digest,
      operation: operationByChild.get(node.id) ?? null,
      depth: current.depth,
    });
    for (const input of node.inputs) {
      if (!operationByChild.has(input.id)) {
        operationByChild.set(input.id, input.operation);
      }
      queue.push({ id: input.id, depth: current.depth + 1 });
    }
  }
  return entries;
}

export function createsCycle(
  nodes: ReadonlyMap<string, ProvenanceNode>,
  outputId: string,
  inputIds: readonly string[],
): boolean {
  if (inputIds.includes(outputId)) {
    return true;
  }
  const seen = new Set<string>();
  const stack = [...inputIds];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) {
      continue;
    }
    if (current === outputId) {
      return true;
    }
    seen.add(current);
    const node = nodes.get(current);
    if (node !== undefined) {
      stack.push(...node.inputs.map((input) => input.id));
    }
  }
  return false;
}
