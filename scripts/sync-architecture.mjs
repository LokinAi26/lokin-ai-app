#!/usr/bin/env node
/**
 * Mirror the canonical architecture packages into base44/shared/ so Base44
 * backend functions import the SAME modules the client uses.
 *
 * Single source of truth: src/architecture/{contracts,materializer,sync}/*.ts
 * Generated mirror:      base44/shared/architecture/{contracts,materializer,sync}/*.ts
 *
 * The subtree structure is preserved so relative imports resolve identically
 * in the mirror. Two deliberate, mechanical transforms are applied on copy:
 *
 * 1. Deno specifier rewrite: the client tree uses TypeScript "nodenext"
 *    convention (`from "../contracts/index.js"` for a `.ts` file), which
 *    Vite resolves. Deno requires exact extensions, so relative `.js`
 *    specifiers are rewritten to `.ts` in the mirror only. The transform is
 *    regex-mechanical and semantics-preserving; the F1 fixture proves the
 *    mirror behaves byte-identically to the source.
 *    Functions import via:
 *      import { ... } from "../../shared/architecture/contracts/schemas.ts";
 *      import { materialize } from "../../shared/architecture/materializer/index.ts";
 *      import { decideIngest } from "../../shared/architecture/sync/ingest.ts";
 *
 * 2. Package file selection: `contracts` and `materializer` mirror every
 *    `.ts` file; `sync` mirrors ONLY the pure shared modules listed below.
 *    Client-only modules (the sync driver, which needs the app's Base44
 *    client) are never mirrored — the backend must not depend on them.
 *
 * Never hand-edit the mirror; edit the source and re-run `npm run sync:contracts`.
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destRoot = join(root, "base44", "shared", "architecture");

/** package -> null (mirror all .ts) or explicit file list */
const PACKAGES = {
  contracts: null,
  materializer: null,
  sync: ["ingest.ts"],
};

/** Rewrite relative `.js` import/export specifiers to `.ts` for Deno. */
function denoRewrite(source) {
  return source.replace(
    /((?:import|export)[^"']*from\s*["'])(\.\.?\/[^"']*)\.js(["'])/g,
    "$1$2.ts$3"
  );
}

rmSync(destRoot, { recursive: true, force: true });
mkdirSync(destRoot, { recursive: true });

let total = 0;
for (const [pkg, files] of Object.entries(PACKAGES)) {
  const src = join(root, "src", "architecture", pkg);
  const dest = join(destRoot, pkg);
  mkdirSync(dest, { recursive: true });
  const names = files ?? readdirSync(src).filter((f) => f.endsWith(".ts"));
  for (const f of names) {
    const rewritten = denoRewrite(readFileSync(join(src, f), "utf8"));
    writeFileSync(join(dest, f), rewritten);
    total += 1;
  }
  writeFileSync(
    join(dest, "README.md"),
    `# architecture/${pkg} (GENERATED MIRROR)\n\nMechanical mirror of \`src/architecture/${pkg}/\`, produced by\n\`scripts/sync-architecture.mjs\` (\`npm run sync:contracts\`).\n\n**Never hand-edit files in this directory.** Edit the canonical source and\nre-run the sync. Relative \`.js\` import specifiers are rewritten to \`.ts\`\nfor Deno; the transform is semantics-preserving (proven by the F1 fixture).\n${files ? `\nOnly the pure shared modules are mirrored: ${files.join(", ")}. Client-only\nmodules in this package are intentionally excluded.\n` : ""}`
  );
}

console.log(`mirrored ${total} architecture files -> base44/shared/architecture/`);
