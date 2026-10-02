/** Category tree helpers (pure, unit-tested): the tree has any depth; every category has at most one parent. */
type Node = { id: string; parentId: string | null };

/** The category and all of its descendants (ids), in any depth. Cycles in bad data cannot loop forever. */
export function descendantIds(rows: Node[], id: string): string[] {
  const children = new Map<string, string[]>();
  for (const r of rows) if (r.parentId) children.set(r.parentId, [...(children.get(r.parentId) ?? []), r.id]);
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (cur: string) => {
    if (seen.has(cur)) return;
    seen.add(cur);
    out.push(cur);
    for (const c of children.get(cur) ?? []) walk(c);
  };
  walk(id);
  return out;
}

/** Rows depth-first (each parent followed by its subtree), with their depth; rows whose parent is missing come last as roots. */
export function treeOrder<T extends Node>(rows: T[]): (T & { depth: number })[] {
  const ids = new Set(rows.map((r) => r.id));
  const byParent = new Map<string | null, T[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  const out: (T & { depth: number })[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const r of byParent.get(parent) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ ...r, depth });
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** True when making `parentId` the parent of `id` would put a category below itself. */
export function wouldCreateCycle(rows: Node[], id: string, parentId: string): boolean {
  return descendantIds(rows, id).includes(parentId);
}

export const MAX_CATEGORY_DEPTH = 8;

export function depthOf(rows: Node[], id: string): number {
  const byId = new Map(rows.map((r) => [r.id, r]));
  let depth = 0;
  for (let cur = byId.get(id); cur?.parentId && depth <= MAX_CATEGORY_DEPTH + 1; cur = byId.get(cur.parentId)) depth++;
  return depth;
}
