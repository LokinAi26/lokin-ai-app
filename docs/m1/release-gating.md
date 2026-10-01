# M1 WP0 — Release / publish gating

## The gate

```bash
npm run release:gate
```

Runs, in order:

1. `npm run typecheck:arch` — strict TypeScript over `src/architecture/`,
   `base44/shared/architecture/`, and the sync function entry.
2. `npm run verify:arch-determinism` — the F1–F6 fixture suite
   (materializer determinism, schema upcast, sync idempotency,
   manifest freshness, dual-write seams, snapshot guard).
3. `node scripts/generate-runtime-manifest.mjs --check` — the committed
   runtime manifest must match the current architecture tree. Refuses to
   run on a dirty git tree.

All three must pass. Any failure blocks merge and publish.

## Enforcement

- **GitHub:** `.github/workflows/arch-gate.yml` runs `release:gate` on
  every push and pull request. A red gate blocks merge.
- **CLI publish path:** run `npm run release:gate` from a clean tree
  before `base44 site deploy` (see AGENTS.md for the eject/build/deploy
  flow). Do not deploy with a red or skipped gate.
- **Base44 dashboard Publish:** this is a browser button only Kendall
  can press; it cannot be code-gated. The release checklist below is the
  enforcement mechanism — Publish is pressed only after a green
  `release:gate` on the exact commit being published.

## Pre-publish checklist (every release)

- [ ] `git status` clean; HEAD is the commit being published.
- [ ] `npm run release:gate` green on that commit.
- [ ] Runtime manifest hash recorded: read it from
      `src/architecture/generated/runtimeManifest.ts`
      (`RUNTIME_MANIFEST_HASH`) and log it with the build.
- [ ] After Base44 dashboard Publish + fresh native iOS build: record
      device model, iOS version, build number alongside the manifest hash.

## What the gate does NOT cover

- The broad `npm run typecheck` (jsconfig over the whole app) still has
  304 pre-existing baseline errors and is intentionally untouched by M1.
- Runtime behavior on device — that is the WP10 device protocol, not a
  build gate.
