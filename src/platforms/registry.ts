import type { PlatformDefinition } from '../core/types';

// The backing store lives behind a HOISTED FUNCTION, not a top-level `const`, on
// purpose. The eager `import.meta.glob` below compiles to static imports that Vite
// hoists ABOVE this module's body, so each platform's `index.ts` calls `register()`
// during this module's import phase — before a `const map = …` would be initialized
// (its temporal dead zone). A function declaration is callable throughout that phase
// and lazily creates the Map on first use. (ADR P1-D5 + best-practices §3.)
function store(): Map<string, PlatformDefinition> {
  const self = store as typeof store & {
    map?: Map<string, PlatformDefinition>;
  };
  return (self.map ??= new Map<string, PlatformDefinition>());
}

/** Register a platform definition. Dedupes by `id` (last write wins). */
export function register(def: PlatformDefinition): void {
  store().set(def.id, def);
}

/** All registered platforms in discovery order. Ordering is the caller's concern. */
export function getPlatforms(): PlatformDefinition[] {
  return [...store().values()];
}

/** Live id→definition map. Readonly at the type level; do not mutate. */
export function getPlatformMap(): ReadonlyMap<string, PlatformDefinition> {
  return store();
}

// Eager glob: each `platforms/<id>/index.ts` runs its top-level register() as an
// import side effect, so adding a platform needs no shared-file edit (ADR P1-D5).
// Vite treats local source modules as having side effects, so this is not
// tree-shaken. With no platform folders the glob matches nothing — harmless.
const _mods = import.meta.glob('./*/index.ts', { eager: true });
void _mods;
