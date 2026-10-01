#!/usr/bin/env node
/**
 * Mirror the canonical architecture packages into base44/shared/ so Base44
 * backend functions import the SAME modules the client uses.
 *
 * Single source of truth: src/architecture/{contracts,materializer}/*.ts
 * Generated mirror:      base44/shared/architecture/{contracts,materializer}/*.ts
 *
 * The subtree structure is preserved so the materializer's relative import
 * of "../contracts/index.js" resolves identically in the mirror. The mirror
 * is byte-identical (plus the READMEs). Never hand-edit the mirror; edit
 * the source and re-run `npm run sync:contracts`.
 * Functions import via:
 *   import { ... } from "../../shared/architecture/contracts/index.js";
 *   import { materialize } from "../../shared/architecture/materializer/index.js";
 */

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destRoot = join(root, "base44", "shared", "architecture");

const PACKAGES = ["contracts", "materializer"];

rmSync(destRoot, { recursive: true, force: true });
mkdirSync(destRoot, { recursive: true });

let total = 0;
for (const pkg of PACKAGES) {
  const src = join(root, "src", "architecture", pkg);
  const dest = join(destRoot, pkg);
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(src)) {
    if (f.endsWith(".ts")) {
      cpSync(join(src, f), join(dest, f));
      total += 1;
    }
  }
  writeFileSync(
    join(dest, "README.md"),
    `# architecture/${pkg} (GENERATED MIRROR)\n\nByte-identical mirror of \`src/architecture/${pkg}/\`, produced by\n\`scripts/sync-architecture.mjs\` (\`npm run sync:contracts\`).\n\n**Never hand-edit files in this directory.** Edit the canonical source and\nre-run the sync. The relative layout is preserved so cross-package\nrelative imports resolve identically here and in \`src/architecture/\`.\n`
  );
}

console.log(`mirrored ${total} architecture files -> base44/shared/architecture/`);
