export interface ViewPart {
  readonly key: string;
  readonly required: boolean;
}

export interface ResourceDocument {
  readonly key: string;
  readonly data: unknown;
}

export interface ScreenView {
  readonly name: string;
  readonly parts: readonly ViewPart[];
}

export interface ViewError {
  readonly key: string;
  readonly code: 'missing';
}

export interface ComposedView {
  readonly name: string;
  readonly ok: boolean;
  readonly partial: boolean;
  readonly data: Readonly<Record<string, unknown>>;
  readonly errors: readonly ViewError[];
}

const keyPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isResourceKey(value: unknown): value is string {
  return typeof value === 'string' && keyPattern.test(value);
}

export function compose(
  view: ScreenView,
  resources: ReadonlyMap<string, ResourceDocument>,
): ComposedView {
  const data: Record<string, unknown> = {};
  const errors: ViewError[] = [];
  for (const part of view.parts) {
    const document = resources.get(part.key);
    if (document === undefined) {
      data[part.key] = null;
      errors.push({ key: part.key, code: 'missing' });
      continue;
    }
    data[part.key] = document.data;
  }
  const requiredMissing = errors.some((error) =>
    view.parts.some((part) => part.key === error.key && part.required),
  );
  return {
    name: view.name,
    ok: !requiredMissing,
    partial: errors.length > 0,
    data,
    errors,
  };
}
